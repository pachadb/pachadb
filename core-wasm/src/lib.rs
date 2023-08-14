mod utils;

use log::*;
use once_cell::sync::Lazy;
pub use pachadb_core::model::*;
use pachadb_core::nanolog::engine::Atom;
use pachadb_core::nanolog::engine::Term;
pub use pachadb_core::TxId;
use pachadb_core::{
    backend::memory::{InMemoryConsolidator, InMemoryIndex, InMemoryStore},
    PachaDb,
};
use wasm_bindgen::prelude::*;

pub static PACHA_DB_INSTANCE: Lazy<PachaDb<InMemoryStore, InMemoryIndex, InMemoryConsolidator>> =
    Lazy::new(|| {
        utils::set_panic_hook();
        wasm_logger::init(wasm_logger::Config::default());

        PachaDb::new(
            InMemoryStore::default(),
            InMemoryIndex::default(),
            InMemoryConsolidator::default(),
        )
    });

#[derive(Default)]
#[wasm_bindgen]
pub struct Client;

#[wasm_bindgen]
impl Client {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self
    }

    pub async fn state(&mut self, obj: JsValue) -> Result<TxId, JsValue> {
        let user_facts: Vec<UserFact> = serde_wasm_bindgen::from_value(obj)?;
        debug!("stating facts {:#?}", user_facts);

        let tx_id = PACHA_DB_INSTANCE
            .state(user_facts)
            .await
            .map_err(|err| JsError::new(&err.to_string()))?;
        debug!("tx_id={:#?}", tx_id);

        Ok(tx_id)
    }

    pub async fn query(&mut self, obj: JsValue) -> Result<JsValue, JsValue> {
        let query: String = serde_wasm_bindgen::from_value(obj)?;
        debug!("querying: {:#?}", &query);
        let atoms = PACHA_DB_INSTANCE
            .query(query)
            .await
            .map_err(|err| JsError::new(&err.to_string()))?;

        let query0 = "query0".to_string();
        let result = atoms
            .into_iter()
            .filter(|atom| matches!(&atom.relation, Term::Sym(s) if *s == query0))
            .collect::<Vec<Atom>>();

        let result = serde_wasm_bindgen::to_value(&result)?;
        debug!("results: {:#?}", &result);
        Ok(result)
    }
}
