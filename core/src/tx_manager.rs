use crate::*;
use async_trait::async_trait;
use serde_derive::{Deserialize, Serialize};

#[derive(
    Default, Debug, Clone, Copy, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct TxId(pub u64);

impl TxId {
    pub fn next(&self) -> Self {
        Self(self.0 + 1)
    }
    pub fn max() -> Self {
        Self(u64::MAX)
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

#[async_trait(?Send)]
pub trait TxManager {
    async fn transaction(&mut self, facts: Vec<UserFact>) -> PachaResult<Transaction>;

    async fn commit(&mut self, tx: Transaction) -> PachaResult<TxId>;

    async fn last_tx_id(&self) -> PachaResult<TxId>;
}

pub struct DefaultTxManager<S: Store, I: Index, C: Consolidator> {
    storage: S,
    index: I,
    consolidator: C,
}

impl<S: Store, I: Index, C: Consolidator> DefaultTxManager<S, I, C> {
    pub fn new(storage: S, index: I, consolidator: C) -> Self {
        Self {
            storage,
            index,
            consolidator,
        }
    }
}

#[async_trait(?Send)]
impl<S, I, C> TxManager for DefaultTxManager<S, I, C>
where
    S: Store,
    I: Index,
    C: Consolidator,
{
    async fn transaction(&mut self, facts: Vec<UserFact>) -> PachaResult<Transaction> {
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

    async fn commit(&mut self, tx: Transaction) -> PachaResult<TxId> {
        self.storage.put_facts(tx.facts.iter()).await?;
        self.storage.put_transaction(&tx).await?;
        self.index.put(tx.facts.iter()).await?;
        self.consolidator.consolidate(tx.facts.iter()).await?;
        Ok(tx.id)
    }

    async fn last_tx_id(&self) -> PachaResult<TxId> {
        self.storage.get_tx_id().await
    }
}
