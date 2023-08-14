mod utils;

use once_cell::sync::Lazy;
pub use pachadb_core::model::*;
pub use pachadb_core::TxId;
use pachadb_core::{
    backend::memory::{InMemoryConsolidator, InMemoryIndex, InMemoryStore},
    PachaDb,
};
use wasm_bindgen::prelude::*;

pub const PACHA_DB_INSTANCE: Lazy<PachaDb<InMemoryStore, InMemoryIndex, InMemoryConsolidator>> =
    Lazy::new(|| {
        PachaDb::new(
            InMemoryStore::default(),
            InMemoryIndex::default(),
            InMemoryConsolidator,
        )
    });

#[wasm_bindgen]
pub struct Client;

#[wasm_bindgen]
impl Client {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {}
    }

    pub async fn state(&mut self, obj: JsValue) -> Result<TxId, JsValue> {
        let user_facts: Vec<UserFact> = serde_wasm_bindgen::from_value(obj)?;
        let tx_id = PACHA_DB_INSTANCE
            .state(user_facts)
            .await
            .map_err(|err| JsError::new(&err.to_string()))?;
        Ok(tx_id)
    }

    pub async fn query(&mut self, obj : JsValue) -> Result<JsValue, JsValue> {
        let query: String = serde_wasm_bindgen::from_value(obj)?;
        let result = PACHA_DB_INSTANCE.query(query).await
            .map_err(|err| JsError::new(&err.to_string()))?;
        let result = serde_wasm_bindgen::to_value(&result)?;
        Ok(result)
    }
}
