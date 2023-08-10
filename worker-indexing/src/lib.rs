extern crate console_error_panic_hook;
use log::*;
use pachadb_core::*;
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

    let index_by_entity = env.kv("pachadb-facts-index-by-entity")?;
    let index_by_entity_field = env.kv("pachadb-facts-index-by-entity-field")?;
    let index_by_field = env.kv("pachadb-facts-index-by-field")?;
    let index_by_field_value = env.kv("pachadb-facts-index-by-field-value")?;
    let index_by_value = env.kv("pachadb-facts-index-by-value")?;

    for fact in facts {
        info!("Indexing fact: {:#?}", &fact);
        let json_fact = serde_json::to_string(&fact)?;

        index_by_entity
            .put(&format!("{}/{}", fact.entity.0, fact.tx_id.0), json_fact.clone())?
            .execute()
            .await?;

        index_by_entity_field
            .put(
                &format!("{}/{}/{}/{}", fact.entity.0, fact.field.0, fact.id.0, fact.tx_id.0),
                json_fact.clone(),
            )?
            .execute()
            .await?;

        index_by_field
            .put(
                &format!("{}/{}/{}", fact.field.0, fact.id.0, fact.tx_id.0),
                json_fact.clone(),
            )?
            .execute()
            .await?;

        index_by_field_value
            .put(
                &format!("{}/{}/{}/{}", fact.field.0, fact.value, fact.id.0, fact.tx_id.0),
                json_fact.clone(),
            )?
            .execute()
            .await?;

        index_by_value
            .put(&format!("{}/{}/{}", fact.value, fact.id.0, fact.tx_id.0), json_fact.clone())?
            .execute()
            .await?;
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
