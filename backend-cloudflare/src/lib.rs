use async_trait::async_trait;
use pachadb_core::*;
use std::sync::Arc;
use worker::*;

#[derive(Clone)]
pub struct CloudflareStore {
    indexing_queue: Arc<Queue>,
    consolidation_queue: Arc<Queue>,
    tx_manager_do: Arc<ObjectNamespace>,
    fact_bucket: Arc<kv::KvStore>,
    tx_bucket: Arc<kv::KvStore>,
    index_by_entity: Arc<kv::KvStore>,
    index_by_entity_field: Arc<kv::KvStore>,
    index_by_field: Arc<kv::KvStore>,
    index_by_field_value: Arc<kv::KvStore>,
    index_by_value: Arc<kv::KvStore>,
}

impl CloudflareStore {
    pub async fn dangerous_reset_transaction_id_to_zero(&self) -> Result<()> {
        let obj_id = self.tx_manager_do.id_from_name("main")?;
        let stub = obj_id.get_stub()?;

        stub.fetch_with_str(
            "https://tx-manager.pachadb.com/dangeours-reset-transaction-id-to-zero",
        )
        .await?
        .text()
        .await?;

        Ok(())
    }

    pub fn new(env: &Env) -> Result<Self> {
        Ok(Self {
            tx_manager_do: Arc::new(env.durable_object("PACHADB_TX_MANAGER")?),
            indexing_queue: Arc::new(env.queue("pachadb-facts-indexing-queue")?),
            consolidation_queue: Arc::new(env.queue("pachadb-facts-consolidation-queue")?),
            fact_bucket: Arc::new(env.kv("pachadb-facts-store")?),
            tx_bucket: Arc::new(env.kv("pachadb-tx-store")?),
            index_by_entity: Arc::new(env.kv("pachadb-facts-index-by-entity")?),
            index_by_entity_field: Arc::new(env.kv("pachadb-facts-index-by-entity-field")?),
            index_by_field: Arc::new(env.kv("pachadb-facts-index-by-field")?),
            index_by_field_value: Arc::new(env.kv("pachadb-facts-index-by-field-value")?),
            index_by_value: Arc::new(env.kv("pachadb-facts-index-by-value")?),
        })
    }

    async fn _get_next_tx_id(&self) -> Result<TxId> {
        let obj_id = self.tx_manager_do.id_from_name("main")?;

        let stub = obj_id.get_stub()?;

        stub.fetch_with_str("https://tx-manager.pachadb.com/new")
            .await?
            .json()
            .await
    }

    async fn _store_facts(&self, facts: impl Iterator<Item = &Fact>) -> Result<()> {
        for fact in facts {
            let json = serde_json::to_string(fact)?;
            self.fact_bucket.put(&fact.id.0, json)?.execute().await?;
        }
        Ok(())
    }

    async fn _store_transaction(&self, tx: &Transaction) -> Result<()> {
        self.tx_bucket
            .put(&tx.id.to_string(), tx.clone())?
            .execute()
            .await?;
        Ok(())
    }
}

#[async_trait(?Send)]
impl pachadb_core::Store for CloudflareStore {
    async fn get_tx_id(&self) -> PachaResult<TxId> {
        todo!()
    }

    async fn get_next_tx_id(&self) -> PachaResult<TxId> {
        self._get_next_tx_id()
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))
    }

    async fn put_facts(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
        self._store_facts(facts)
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        Ok(())
    }

    async fn put_transaction(&self, tx: &Transaction) -> PachaResult<()> {
        self._store_transaction(tx)
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        Ok(())
    }

    async fn get_fact(&self, _uri: Uri) -> PachaResult<Option<Fact>> {
        todo!()
    }
}

#[async_trait(?Send)]
impl pachadb_core::Index for CloudflareStore {
    async fn put(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
        for fact in facts {
            self.indexing_queue
                .send(&fact.id)
                .await
                .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        }
        Ok(())
    }

    async fn scan(&self, scan: Scan) -> PachaResult<Box<dyn Iterator<Item = IndexKey>>> {
        let prefix = scan.to_prefix();

        let list = self
            .index_by_field_value
            .list()
            .prefix(prefix)
            .execute()
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;

        Ok(Box::new(
            list.keys.into_iter().map(|key| key.name.parse().unwrap()),
        ))
    }

    async fn get(&self, key: IndexKey) -> PachaResult<Option<Uri>> {
        self.index_by_field_value
            .get(&key.to_string())
            .json::<Uri>()
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))
    }
}

#[async_trait(?Send)]
impl pachadb_core::Consolidator for CloudflareStore {
    async fn consolidate(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
        for fact in facts {
            self.consolidation_queue
                .send(&fact.id)
                .await
                .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        }
        Ok(())
    }
}
