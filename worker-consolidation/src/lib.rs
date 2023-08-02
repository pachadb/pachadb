extern crate console_error_panic_hook;
use log::*;
use pachadb_core::*;
use std::collections::HashMap;
use std::panic;
use worker::*;

#[event(queue)]
async fn main(batch: MessageBatch<Uri>, env: Env, _ctx: Context) -> Result<()> {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
    wasm_logger::init(wasm_logger::Config::default());

    let fact_ids: Vec<Uri> = batch.messages()?.into_iter().map(|msg| msg.body).collect();
    info!("Handling batch of {} facts", fact_ids.len());

    let facts = fetch_all_facts(&env, fact_ids).await?;
    info!("Fetched {} facts", facts.len());

    let facts_by_entity = facts.into_iter().fold(HashMap::new(), |mut map, fact| {
        map.entry(fact.entity.clone())
            .or_insert_with(Vec::new)
            .push(fact);
        map
    });

    info!("For {} entities", facts_by_entity.keys().count());

    let entities_bucket = env.kv("pachadb-entities-store")?;
    let entities_queue = env.queue("pachadb-entities-queue")?;
    for (entity_uri, facts) in facts_by_entity {
        info!("Consolidating entity {:?}", &entity_uri);
        let mut entity: Entity = entities_bucket
            .get(&entity_uri.0)
            .json()
            .await?
            .unwrap_or_else(|| Entity::new(entity_uri.clone()));

        for fact in facts {
            entity.consolidate(fact);
        }

        let json_entity = serde_json::to_string(&entity)?;
        entities_bucket
            .put(&entity.uri.0, json_entity)?
            .execute()
            .await?;

        entities_queue.send(&entity.uri.0).await?;
        info!("Published entity uri {:?}", &entity_uri);
    }

    Ok(())
}

async fn fetch_all_facts(env: &Env, ids: Vec<Uri>) -> Result<Vec<Fact>> {
    let mut facts = vec![];
    for id in ids {
        let fact_store = env.kv("pachadb-facts-store")?;
        let fact: Fact = fact_store.get(&id.0).json().await?.unwrap();
        facts.push(fact);
    }
    Ok(facts)
}
