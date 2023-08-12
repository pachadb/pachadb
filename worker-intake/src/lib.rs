extern crate console_error_panic_hook;
use log::*;
use pachadb_core::*;

use std::panic;
use worker::*;

#[durable_object]
pub struct TxManager {
    state: State,
    env: Env,
}

#[durable_object]
impl DurableObject for TxManager {
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

pub struct TxClient;

impl TxClient {
    pub async fn dangerous_reset_transaction_id_to_zero(&self, env: &Env) -> Result<()> {
        let ns = env.durable_object("PACHADB_TX_MANAGER")?;
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

    pub async fn next_tx_id(&self, env: &Env) -> Result<TxId> {
        let ns = env.durable_object("PACHADB_TX_MANAGER")?;
        let obj_id = ns.id_from_name("main")?;
        let stub = obj_id.get_stub()?;
        let tx_id: TxId = stub
            .fetch_with_str("https://tx-manager.pachadb.com/new")
            .await?
            .json()
            .await?;

        Ok(tx_id)
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
						TxClient.dangerous_reset_transaction_id_to_zero(&ctx.env).await?;
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
						let tx_id = TxClient.next_tx_id(&ctx.env).await?;

            info!("Saving {} facts with tx_id={:?}..", state_req.facts.len(), tx_id);
            let mut tasks = vec![];
            for fact in state_req.facts {
                tasks.push(handle_fact(&ctx.env, fact, tx_id));
            }

            let mut facts = vec![];
            for res in futures::future::join_all(tasks).await {
                facts.push(res?);
            }

						let tx = Transaction {
							tx_id,
							fact_ids: facts.iter().map(|f| f.id.clone()).collect::<Vec<Uri>>()
						};

						let tx_bucket = ctx.env.kv("pachadb-tx-store")?;

						// TODO(@ostera): tx.commit().await?;

						tx_bucket
							.put(&tx_id.0.to_string(), tx)?
							.execute()
							.await?;

            Response::from_json(&StateFactsRes { facts })
        })
        .run(req, env)
        .await
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

async fn handle_fact(env: &Env, fact: UserFact, tx_id: TxId) -> Result<Fact> {
    let fact = Fact {
        tx_id,
        id: Uri(format!("pachadb:fact:{}", uuid::Uuid::new_v4())),
        entity: fact.entity,
        field: fact.field,
        source: fact.source,
        value: fact.value,
        stated_at: fact.stated_at,
    };
    let fact_bucket = env.kv("pachadb-facts-store")?;
    let json_fact = serde_json::to_string(&fact)?;

    fact_bucket
        .put(&fact.id.0, json_fact.clone())?
        .execute()
        .await?;

    let fact_indexing_queue = env.queue("pachadb-facts-indexing-queue")?;
    fact_indexing_queue.send(&fact.id).await?;

    let fact_consolidation_queue = env.queue("pachadb-facts-consolidation-queue")?;
    fact_consolidation_queue.send(&fact.id).await?;

    Ok(fact)
}
