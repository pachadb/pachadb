pub mod backend;
mod consolidation;
mod error;
mod index;
pub mod model;
pub mod nanolog;
mod query_executor;
mod query_planner;
mod store;
mod tx_manager;

#[cfg(not(feature = "wasm"))]
mod value;
#[cfg(not(feature = "wasm"))]
pub use value::*;

#[cfg(feature = "wasm")]
pub use backend::wasm::*;

pub use consolidation::*;
pub use error::*;
pub use index::*;
pub use model::*;
pub use query_executor::*;
pub use query_planner::*;
pub use store::*;
pub use tx_manager::*;

use log::*;
use nanolog::engine::Atom;
use nanolog::parser::Parser;
use std::collections::HashMap;
use std::sync::Arc;

use crate::nanolog::engine::Term;

#[cfg(test)]
#[macro_use]
extern crate assert_matches;

#[cfg(test)]
#[macro_use]
extern crate quickcheck_async;

pub struct PachaDb<S: Store, Idx: Index, C: Consolidator> {
    tx_manager: DefaultTxManager<S, Idx, C>,
    query_planner: DefaultQueryPlanner,
    query_executor: DefaultQueryExecutor<S, Idx>,
}

impl<S, Idx, C> PachaDb<S, Idx, C>
where
    S: Store,
    Idx: Index,
    C: Consolidator,
{
    pub fn new(store: S, index: Idx, consolidator: C) -> Self {
        let tx_manager = DefaultTxManager::new(store.clone(), index.clone(), consolidator);
        let query_executor = DefaultQueryExecutor::new(store.clone(), index.clone());
        Self {
            tx_manager,
            query_planner: DefaultQueryPlanner,
            query_executor,
        }
    }

    pub async fn state(&self, facts: Vec<UserFact>) -> PachaResult<TxId> {
        debug!("stating {} facts", facts.len());
        let tx = self.tx_manager.transaction(facts).await?;
        debug!(
            "tx_id = {:#?} -> {:#?}",
            tx.id,
            self.tx_manager.last_tx_id().await?
        );
        self.tx_manager.commit(tx).await
    }

    pub async fn query(&self, query: impl AsRef<str>) -> PachaResult<Vec<HashMap<String, String>>> {
        let query = query.as_ref();
        debug!("running query {}", query);
        let query = Parser.parse(query)?;
        let headers = query.head.args.clone();
        debug!("parsed query {:#?}", query);
        let tx_id = self.tx_manager.last_tx_id().await?;
        let plan = self.query_planner.plan(query, tx_id)?;

        let query0 = "query0".to_string();
        let mut results: Vec<HashMap<String, String>> = vec![];
        'row: for row in self.query_executor.execute(plan).await? {
            if matches!(&row.relation, Term::Sym(s) if *s == query0) {
                let mut row_map = HashMap::default();
                for (k, v) in headers.clone().into_iter().zip(row.args) {
                    match (k, v) {
                        (Term::Var(_name, Some(expected)), Term::Sym(value))
                            if expected != value =>
                        {
                            continue 'row;
                        }
                        (Term::Var(name, _), Term::Sym(value)) => {
                            row_map.insert(name, value);
                        }
                        _ => unreachable!(),
                    }
                }
                results.push(row_map);
            }
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::memory::*;

    #[tokio::test]
    async fn simple_test() {
        let _db = PachaDb::new(
            InMemoryStore::default(),
            InMemoryIndex::default(),
            InMemoryConsolidator::default(),
        );
    }
}
