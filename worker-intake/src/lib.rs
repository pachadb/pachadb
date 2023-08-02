extern crate console_error_panic_hook;
use log::*;
use pachadb_core::*;
use serde::{Deserialize, Serialize};
use std::panic;
use worker::*;

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
    wasm_logger::init(wasm_logger::Config::default());

    let router = Router::new();

    router
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

            info!("Saving {} facts..", state_req.facts.len());
            let mut tasks = vec![];
            for fact in state_req.facts {
                tasks.push(handle_fact(&ctx.env, fact));
            }

            let mut facts = vec![];
            for res in futures::future::join_all(tasks).await {
                facts.push(res?);
            }

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

async fn handle_fact(env: &Env, fact: UserFact) -> Result<Fact> {
    let fact = Fact {
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

    let fact_queue = env.queue("pachadb-facts-queue")?;
    fact_queue.send(&fact.id).await?;

    Ok(fact)
}
