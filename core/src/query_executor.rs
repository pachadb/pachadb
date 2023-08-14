use crate::*;
use async_recursion::async_recursion;
use async_trait::async_trait;
use pachadb_nanolog::engine::{Atom, Rule, Solver, Term};
use pachadb_nanolog::{atom, rule, sym};
use std::collections::HashSet;

#[async_trait(?Send)]
pub trait QueryExecutor {
    async fn execute(&self, plan: QueryPlan) -> PachaResult<Vec<Atom>>;
}

pub struct DefaultQueryExecutor<S: Store, I: Index> {
    index: I,
    store: S,
    solver: Solver,
}

impl<S, I> DefaultQueryExecutor<S, I>
where
    S: Store,
    I: Index,
{
    pub fn new(store: S, index: I) -> Self {
        Self {
            index,
            store,
            solver: Solver,
        }
    }

    #[async_recursion(?Send)]
    async fn do_run_query(&self, plan: QueryPlan, mut rules: Vec<Rule>) -> PachaResult<Vec<Atom>> {
        match plan {
            QueryPlan::RunScan(tx_id, scans, next) => {
                let rules = self.do_run_scan(tx_id, scans, rules).await?;
                self.do_run_query(*next, rules).await
            }
            QueryPlan::Solve(query) => {
                rules.push(query);
                Ok(self.solver.solve(rules))
            }
        }
    }

    async fn do_run_scan(
        &self,
        tx_id: TxId,
        scans: Vec<Scan>,
        mut rules: Vec<Rule>,
    ) -> PachaResult<Vec<Rule>> {
        let mut uris: HashSet<Uri> = HashSet::default();
        for scan in scans {
            for key in self.index.scan(scan).await? {
                if key.tx_id < tx_id {
                    let uri =
                        self.index
                            .get(key)
                            .await?
                            .ok_or(PachaError::UnrecoverableStorageError(
                                "missing fact from index! is the index corrupted?".to_string(),
                            ))?;
                    uris.insert(uri);
                }
            }
        }

        for uri in uris {
            let fact =
                self.store
                    .get_fact(uri)
                    .await?
                    .ok_or(PachaError::UnrecoverableStorageError(
                        "missing fact from store! is the index corrupted?".to_string(),
                    ))?;

            let rule = rule!(
                atom!(
                    sym!(fact.entity.0),
                    sym!(fact.field.0),
                    sym!(fact.value.to_string())
                ),
                vec![]
            );

            rules.push(rule);
        }

        Ok(rules)
    }
}

#[async_trait(?Send)]
impl<S, I> QueryExecutor for DefaultQueryExecutor<S, I>
where
    S: Store,
    I: Index,
{
    async fn execute(&self, plan: QueryPlan) -> PachaResult<Vec<Atom>> {
        self.do_run_query(plan, vec![]).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;

    #[derive(Clone)]
    struct UnreachableStore;
    #[async_trait(?Send)]
    impl Store for UnreachableStore {
        async fn get_tx_id(&self) -> PachaResult<TxId> {
            unreachable!()
        }

        async fn get_next_tx_id(&self) -> PachaResult<TxId> {
            unreachable!()
        }

        async fn get_fact(&self, _uri: Uri) -> PachaResult<Option<Fact>> {
            unreachable!()
        }

        async fn put_facts(&self, _facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
            unreachable!()
        }

        async fn put_transaction(&self, _tx: &Transaction) -> PachaResult<()> {
            unreachable!()
        }
    }

    #[quickcheck_async::tokio]
    async fn on_empty_indices_return_nothing(plan: QueryPlan) -> bool {
        #[derive(Default, Clone)]
        struct EmptyIndex;
        #[async_trait(?Send)]
        impl Index for EmptyIndex {
            async fn put(&self, _facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
                unreachable!()
            }

            async fn scan(&self, _prefix: Scan) -> PachaResult<Box<dyn Iterator<Item = IndexKey>>> {
                Ok(Box::new(vec![].into_iter()))
            }

            async fn get(&self, _key: IndexKey) -> PachaResult<Option<Uri>> {
                unreachable!()
            }
        }

        let exec = DefaultQueryExecutor::new(UnreachableStore, EmptyIndex);
        let results = exec.execute(plan).await.unwrap();
        results.is_empty()
    }

    #[quickcheck_async::tokio]
    async fn calls_index(plan: QueryPlan) -> bool {
        #[derive(Default, Clone)]
        struct SpyableIndex {
            was_called: Rc<RefCell<bool>>,
        }
        #[async_trait(?Send)]
        impl Index for SpyableIndex {
            async fn put(&self, _facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
                unreachable!()
            }

            async fn scan(&self, _prefix: Scan) -> PachaResult<Box<dyn Iterator<Item = IndexKey>>> {
                self.was_called.replace(true);
                Ok(Box::new(vec![].into_iter()))
            }

            async fn get(&self, _key: IndexKey) -> PachaResult<Option<Uri>> {
                unreachable!()
            }
        }

        let was_called = Rc::new(RefCell::new(false));
        let index = SpyableIndex {
            was_called: was_called.clone(),
        };
        let exec = DefaultQueryExecutor::new(UnreachableStore, index);

        let _results = exec.execute(plan).await.unwrap();

        was_called.take()
    }
}
