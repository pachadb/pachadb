extern crate console_error_panic_hook;
use log::*;
use pachadb_core::*;

use std::panic;
use worker::{async_trait::async_trait, *};

#[durable_object]
pub struct DurObjTxManager {
    state: State,
    env: Env,
}

#[durable_object]
impl DurableObject for DurObjTxManager {
    fn new(state: State, env: Env) -> Self {
        Self { state, env }
    }

    async fn fetch(&mut self, req: Request) -> Result<Response> {
        let _router = Router::new();

        let mut storage = self.state.storage();
        match req.path().as_str() {
            "/dangeours-reset-transaction-id-to-zero" => {
                storage.put("tx_id", &TxId::default()).await?;
                Response::ok("ok".to_string())
            }
            _ => {
                let tx_id: TxId = if let Ok(tx_id) = storage.get("tx_id").await {
                    tx_id
                } else {
                    TxId::default()
                };
                info!("Fetching new transaction id = {:?}", &tx_id);
                storage.put("tx_id", tx_id.next()).await?;
                Response::from_json(&tx_id)
            }
        }
    }
}

pub struct CloudflareTransactionStorage<'env> {
    env: &'env Env,
}

impl<'env> CloudflareTransactionStorage<'env> {
    pub fn new(env: &'env Env) -> Self {
        Self { env }
    }

    pub async fn dangerous_reset_transaction_id_to_zero(&self) -> Result<()> {
        let ns = self.env.durable_object("PACHADB_TX_MANAGER")?;
        let obj_id = ns.id_from_name("main")?;
        let stub = obj_id.get_stub()?;
        stub.fetch_with_str(
            "https://tx-manager.pachadb.com/dangeours-reset-transaction-id-to-zero",
        )
        .await?
        .text()
        .await?;
        Ok(())
    }

    async fn _get_next_tx_id(&self) -> Result<TxId> {
        let ns = self.env.durable_object("PACHADB_TX_MANAGER")?;

        let obj_id = ns.id_from_name("main")?;

        let stub = obj_id.get_stub()?;

        stub.fetch_with_str("https://tx-manager.pachadb.com/new")
            .await?
            .json()
            .await
    }

    async fn _store_facts(&self, facts: &[Fact]) -> Result<()> {
        info!("Saving {} facts", facts.len());
        let fact_bucket = self.env.kv("pachadb-facts-store")?;
        for fact in facts {
            let json = serde_json::to_string(&fact)?;
            fact_bucket.put(&fact.id.0, json)?.execute().await?;
        }
        Ok(())
    }

    async fn _store_transaction(&self, tx: &Transaction) -> Result<()> {
        let tx_bucket = self.env.kv("pachadb-tx-store")?;
        tx_bucket
            .put(&tx.id.to_string(), tx.clone())?
            .execute()
            .await?;
        Ok(())
    }
}

#[async_trait(?Send)]
impl<'env> pachadb_core::TxStorage for CloudflareTransactionStorage<'env> {
    async fn get_next_tx_id(&self) -> PachaResult<TxId> {
        self._get_next_tx_id()
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))
    }

    async fn store_facts(&self, facts: &[Fact]) -> PachaResult<()> {
        self._store_facts(facts)
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        Ok(())
    }

    async fn store_transaction(&self, tx: &Transaction) -> PachaResult<()> {
        self._store_transaction(tx)
            .await
            .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        Ok(())
    }
}

pub struct CloudflareQueueIndexer {
    queue: Queue,
}

impl CloudflareQueueIndexer {
    pub fn new(env: &Env) -> Result<Self> {
        Ok(Self {
            queue: env.queue("pachadb-facts-indexing-queue")?,
        })
    }
}

#[async_trait(?Send)]
impl Indexer for CloudflareQueueIndexer {
    async fn index(&self, facts: &[Fact]) -> PachaResult<()> {
        for fact in facts {
            self.queue
                .send(&fact.id)
                .await
                .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        }
        Ok(())
    }
}

pub struct CloudflareQueueConsolidator {
    queue: Queue,
}

impl CloudflareQueueConsolidator {
    pub fn new(env: &Env) -> Result<Self> {
        Ok(Self {
            queue: env.queue("pachadb-facts-consolidation-queue")?,
        })
    }
}

#[async_trait(?Send)]
impl Consolidator for CloudflareQueueConsolidator {
    async fn consolidate(&self, facts: &[Fact]) -> PachaResult<()> {
        for fact in facts {
            self.queue
                .send(&fact.id)
                .await
                .map_err(|err| PachaError::UnrecoverableStorageError(err.to_string()))?;
        }
        Ok(())
    }
}

#[event(fetch, respond_with_errors)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
    wasm_logger::init(wasm_logger::Config::default());

    let router = Router::new();

    router
				.get_async("/_pacha/db/nuke", |_req, ctx| async move {
						info!("nuking database");
					for kv in ["pachadb-entities-store",
					"pachadb-facts-index-by-entity",
					"pachadb-facts-index-by-entity-field",
					"pachadb-facts-index-by-field",
					"pachadb-facts-index-by-field-value",
					"pachadb-facts-index-by-value",
					"pachadb-facts-store",
					"pachadb-tx-store"] {
						info!("cleaning {:?}", kv);
						let kv = ctx.kv(kv)?;
						let res = kv.list().execute().await?;
						for key in res.keys {
							info!("- {:?}", &key.name);
							kv.delete(&key.name).await?;
						}
					}
						let do_store = CloudflareTransactionStorage::new(&ctx.env);
						do_store.dangerous_reset_transaction_id_to_zero().await?;
					Response::ok("ok".to_string())
				})
        .get_async("/:uri", |req, ctx| async move {
            let Some(uri) = ctx.param("uri") else { return Response::error("must specify a uri", 405) };
            info!("Fetching {}", req.path());
            if let Some(result) = fetch_entity_or_fact(&ctx.env, uri).await? {
                Response::ok(result)
            } else {
                Response::error("entity or fact not found", 404)
            }
        })
        .post_async("/", |mut req, ctx| async move {
            let state_req: StateFactsReq = req.json().await?;

						let tx_id = state_facts(&ctx.env, state_req).await?;

            Response::from_json(&StateFactsRes { tx_id })
        })
        .run(req, env)
        .await
}

async fn state_facts(env: &Env, state_req: StateFactsReq) -> Result<TxId> {
    let do_store = CloudflareTransactionStorage::new(env);
    let indexer = CloudflareQueueIndexer::new(env)?;
    let consolidator = CloudflareQueueConsolidator::new(env)?;

    let tx_mgr = pachadb_core::DefaultTxManager::new(do_store, indexer, consolidator);
    let tx = tx_mgr.transaction(state_req.facts).await
							.map_err(|err| Error::RustError(err.to_string()))?;

    tx_mgr.commit(tx).await
							.map_err(|err| Error::RustError(err.to_string()))
}

async fn fetch_entity_or_fact(env: &Env, uri: &str) -> Result<Option<String>> {
    let fact_bucket = env.kv("pachadb-facts-store")?;
    let entities_bucket = env.kv("pachadb-entities-store")?;
    let entity_result: Option<Entity> = entities_bucket.get(uri).json().await?;
    if let Some(entity) = entity_result {
        Ok(Some(serde_json::to_string(&entity)?))
    } else {
        let fact: Option<Fact> = fact_bucket.get(uri).json().await?;
        if let Some(fact) = fact {
            Ok(Some(serde_json::to_string(&fact)?))
        } else {
            Ok(None)
        }
    }
}
