mod util;

use async_recursion::async_recursion;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use pachadb_nanolog::{
    atom,
    engine::{Atom, Rule, Solver, Term},
    parser::{ParseError, Parser},
    rule, sym,
};
use serde_derive::{Deserialize, Serialize};
use std::{collections::HashMap, str::FromStr};
use thiserror::*;

#[derive(Error, Debug)]
pub enum PachaError {
    #[error("Unrecoverable storage errror. Reason: {0}")]
    UnrecoverableStorageError(String),

    #[error(transparent)]
    QueryParsingError(ParseError),

    #[error(transparent)]
    Unknown(anyhow::Error),
}

impl From<ParseError> for PachaError {
    fn from(value: ParseError) -> Self {
        Self::QueryParsingError(value)
    }
}

pub type PachaResult<V> = std::result::Result<V, PachaError>;

#[derive(Debug, Clone, Hash, Eq, PartialEq, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Uri(pub String);

#[derive(Default, Debug, Clone, Copy, Eq, PartialEq, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct TxId(pub u64);

impl TxId {
    pub fn next(&self) -> Self {
        Self(self.0 + 1)
    }
}

impl ToString for TxId {
    fn to_string(&self) -> String {
        self.0.to_string()
    }
}

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: TxId,
    pub fact_ids: Vec<Uri>,
    pub facts: Vec<Fact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fact {
    pub tx_id: TxId,
    pub id: Uri,
    pub entity: Uri,
    pub field: Uri,
    pub source: Uri,
    pub value: String,
    #[serde(with = "util::serde::iso8601")]
    pub stated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFact {
    pub entity: Uri,
    pub field: Uri,
    pub source: Uri,
    pub value: String,
    #[serde(with = "util::serde::iso8601")]
    pub stated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryReq {
    pub query: String,
    pub tx_id: TxId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateFactsReq {
    pub facts: Vec<UserFact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateFactsRes {
    pub tx_id: TxId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub uri: Uri,
    pub fields: HashMap<Uri, String>,
    pub prior_facts: HashMap<Uri, Fact>,
    #[serde(with = "util::serde::iso8601")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "util::serde::iso8601")]
    pub last_updated_at: DateTime<Utc>,
}

impl Entity {
    pub fn new(uri: Uri) -> Self {
        Self {
            uri,
            created_at: chrono::Utc::now(),
            last_updated_at: chrono::Utc::now(),
            fields: Default::default(),
            prior_facts: Default::default(),
        }
    }

    pub fn consolidate(&mut self, fact: Fact) {
        if let Some(prior_fact) = self.prior_facts.get(&fact.field) {
            if fact.stated_at >= prior_fact.stated_at {
                self.insert_fact(fact);
            }
        } else {
            self.insert_fact(fact);
        }
    }

    pub fn insert_fact(&mut self, fact: Fact) {
        self.fields.insert(fact.field.clone(), fact.value.clone());
        self.prior_facts.insert(fact.field.clone(), fact);
        self.last_updated_at = chrono::Utc::now();
    }
}

#[async_trait(?Send)]
pub trait TxStorage {
    async fn get_next_tx_id(&self) -> PachaResult<TxId>;

    async fn store_facts(&self, facts: &[Fact]) -> PachaResult<()>;

    async fn store_transaction(&self, tx: &Transaction) -> PachaResult<()>;
}

#[async_trait(?Send)]
pub trait TxManager {
    async fn transaction(&self, facts: Vec<UserFact>) -> PachaResult<Transaction>;

    async fn commit(&self, tx: Transaction) -> PachaResult<TxId>;
}

#[async_trait(?Send)]
pub trait Indexer {
    async fn index(&self, facts: &[Fact]) -> PachaResult<()>;
}

#[async_trait(?Send)]
pub trait Consolidator {
    async fn consolidate(&self, consolidate: &[Fact]) -> PachaResult<()>;
}

pub struct DefaultTxManager<S: TxStorage, I: Indexer, C: Consolidator> {
    storage: S,
    indexer: I,
    consolidator: C,
}

impl<S: TxStorage, I: Indexer, C: Consolidator> DefaultTxManager<S, I, C> {
    pub fn new(storage: S, indexer: I, consolidator: C) -> Self {
        Self {
            storage,
            indexer,
            consolidator,
        }
    }
}

#[async_trait(?Send)]
impl<S, I, C> TxManager for DefaultTxManager<S, I, C>
where
    S: TxStorage,
    I: Indexer,
    C: Consolidator,
{
    async fn transaction(&self, facts: Vec<UserFact>) -> PachaResult<Transaction> {
        let tx_id: TxId = self.storage.get_next_tx_id().await?;

        let facts = facts
            .into_iter()
            .map(|fact| Fact {
                tx_id,
                id: Uri(format!("pachadb:fact:{}", uuid::Uuid::new_v4())),
                entity: fact.entity,
                field: fact.field,
                source: fact.source,
                value: fact.value,
                stated_at: fact.stated_at,
            })
            .collect();

        Ok(Transaction {
            id: tx_id,
            fact_ids: vec![],
            facts,
        })
    }

    async fn commit(&self, tx: Transaction) -> PachaResult<TxId> {
        self.storage.store_facts(&tx.facts).await?;
        self.storage.store_transaction(&tx).await?;
        self.indexer.index(&tx.facts).await?;
        self.consolidator.consolidate(&tx.facts).await?;
        Ok(tx.id)
    }
}

pub enum Scan {
    Entity(String),
    EntityField(String, String),
    Field(String),
    FieldValue(String, String),
    EntityValue(String, String),
    Value(String),
}

pub enum QueryPlan {
    RunScan(TxId, Vec<Scan>, Box<QueryPlan>),
    Solve,
}

#[async_trait(?Send)]
pub trait QueryPlanner {
    async fn plan_query(&self, query: String, tx_id: TxId) -> PachaResult<QueryPlan>;
}

#[derive(Default)]
pub struct DefaultQueryPlanner {}

#[async_trait(?Send)]
impl QueryPlanner for DefaultQueryPlanner {
    async fn plan_query(&self, query: String, tx_id: TxId) -> PachaResult<QueryPlan> {
        let query = Parser.parse(&query)?;

        let scans: Vec<Scan> = query
            .body
            .iter()
            .flat_map(|atom| match &atom.relation {
                Term::Var(_) => {
                    let entity = atom.args.get(0).unwrap();
                    let value = atom.args.get(1).unwrap();
                    match (entity, value) {
                        (Term::Var(_), Term::Sym(v)) => vec![Scan::Value(v.clone())],
                        (Term::Sym(e), Term::Var(_)) => vec![Scan::Entity(e.clone())],
                        (Term::Sym(e), Term::Sym(v)) => {
                            vec![Scan::EntityValue(e.clone(), v.clone())]
                        }
                        (Term::Var(_), Term::Var(_)) => vec![],
                    }
                }
                Term::Sym(f) => {
                    let entity = atom.args.get(0).unwrap();
                    let value = atom.args.get(1).unwrap();
                    match (entity, value) {
                        (Term::Var(_), Term::Sym(v)) => {
                            vec![Scan::FieldValue(f.clone(), v.clone())]
                        }
                        (Term::Sym(e), Term::Var(_)) => {
                            vec![Scan::EntityField(e.clone(), f.clone())]
                        }
                        (Term::Sym(_), Term::Sym(_)) => vec![],
                        (Term::Var(_), Term::Var(_)) => vec![Scan::Field(f.clone())],
                    }
                }
            })
            .collect();

        Ok(QueryPlan::RunScan(tx_id, scans, QueryPlan::Solve.into()))
    }
}

#[async_trait(?Send)]
pub trait QueryExecutor {
    async fn run_query_plan(&self, plan: QueryPlan) -> PachaResult<Vec<Atom>>;
}

pub struct IndexKey {
    pub prefix: String,
    pub tx_id: TxId,
}

impl ToString for IndexKey {
    fn to_string(&self) -> String {
        format!("{}/{}", self.prefix.clone(), self.tx_id.0)
    }
}

impl FromStr for IndexKey {
    type Err = PachaError;

    fn from_str(key: &str) -> Result<Self, Self::Err> {
        let fact_tx_id: u64 = key.split('/').last().unwrap().parse().unwrap();
        Ok(Self {
            prefix: key.to_string(),
            tx_id: TxId(fact_tx_id),
        })
    }
}

#[async_trait(?Send)]
pub trait IndexStore {
    async fn scan(&self, prefix: &str) -> PachaResult<Box<dyn Iterator<Item = IndexKey>>>;
    async fn get(&self, key: IndexKey) -> PachaResult<Option<Fact>>;
}

pub struct DefaultQueryExecutor<IS: IndexStore> {
    scanner: IndexScanner<IS>,
    solver: Solver,
}

#[async_trait(?Send)]
impl<IS> QueryExecutor for DefaultQueryExecutor<IS>
where
    IS: IndexStore,
{
    async fn run_query_plan(&self, plan: QueryPlan) -> PachaResult<Vec<Atom>> {
        self.do_run_query(plan, vec![]).await
    }
}

impl<IS> DefaultQueryExecutor<IS>
where
    IS: IndexStore,
{
    pub fn new(scanner: IndexScanner<IS>) -> Self {
        Self {
            scanner,
            solver: Solver,
        }
    }

    #[async_recursion(?Send)]
    async fn do_run_query(&self, plan: QueryPlan, mut rules: Vec<Rule>) -> PachaResult<Vec<Atom>> {
        match plan {
            QueryPlan::RunScan(tx_id, scans, next) => {
                for scan in scans {
                    let new_rules = self.scanner.fetch(scan, tx_id).await?;
                    rules.extend(new_rules);
                }
                self.do_run_query(*next, rules).await
            }
            QueryPlan::Solve => Ok(self.solver.solve(rules)),
        }
    }
}

pub struct IndexScanner<IS: IndexStore> {
    index_by_entity: IS,
    index_by_entity_field: IS,
    index_by_entity_value: IS,
    index_by_field: IS,
    index_by_field_value: IS,
    index_by_value: IS,
}

impl<IS: IndexStore> IndexScanner<IS> {
    pub fn new(
        index_by_entity: IS,
        index_by_entity_field: IS,
        index_by_entity_value: IS,
        index_by_field: IS,
        index_by_field_value: IS,
        index_by_value: IS,
    ) -> Self {
        Self {
            index_by_entity,
            index_by_entity_field,
            index_by_entity_value,
            index_by_field,
            index_by_field_value,
            index_by_value,
        }
    }

    pub async fn fetch(&self, scan: Scan, max_tx: TxId) -> PachaResult<Vec<Rule>> {
        let (kv, prefix) = match scan {
            Scan::Entity(prefix) => (&self.index_by_entity, prefix),
            Scan::EntityField(e, f) => (&self.index_by_entity_field, format!("{}/{}", e, f)),
            Scan::Field(f) => (&self.index_by_field, f),
            Scan::FieldValue(f, v) => (&self.index_by_field_value, format!("{}/{}", f, v)),
            Scan::EntityValue(e, v) => (&self.index_by_entity_value, format!("{}/{}", e, v)),
            Scan::Value(v) => (&self.index_by_value, v),
        };

        let mut rules = vec![];
        for key in kv.scan(&prefix).await? {
            if key.tx_id <= max_tx {
                let fact = kv.get(key).await?.unwrap();
                let rule = rule!(
                    atom!(sym!(fact.entity.0), sym!(fact.field.0), sym!(fact.value)),
                    vec![]
                );
                rules.push(rule);
            }
        }

        Ok(rules)
    }
}
