pub mod nanolog;
pub mod backend;
mod consolidation;
mod error;
mod index;
pub mod model;
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

use nanolog::engine::Atom;
use nanolog::parser::Parser;
use std::sync::Arc;
use log::*;

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
        debug!("tx_id = {:#?} -> {:#?}", tx.id, self.tx_manager.last_tx_id().await?);
        self.tx_manager.commit(tx).await
    }

    pub async fn query(&self, query: impl AsRef<str>) -> PachaResult<Vec<Atom>> {
        let query = query.as_ref();
        debug!("runnig query {}", query);
        let query = Parser.parse(query)?;
        let tx_id = self.tx_manager.last_tx_id().await?;
        let plan = self.query_planner.plan(query, tx_id)?;
        self.query_executor.execute(plan).await
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
            InMemoryConsolidator,
        );
    }
}
