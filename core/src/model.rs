#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

use crate::*;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Hash, Eq, PartialEq, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
#[cfg_attr(feature = "wasm", wasm_bindgen(getter_with_clone))]
pub struct Uri(pub String);

impl ToString for Uri {
    fn to_string(&self) -> String {
        self.0.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", wasm_bindgen(getter_with_clone))]
pub struct Fact {
    pub tx_id: TxId,
    pub id: Uri,
    pub entity: Uri,
    pub field: Uri,
    pub source: Uri,
    pub value: Value,
    pub stated_at: DateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", wasm_bindgen(getter_with_clone))]
pub enum FactMode {
    State = 0,
    Retract = 1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", wasm_bindgen(getter_with_clone))]
pub struct UserFact {
    pub entity: Uri,
    pub field: Uri,
    pub source: Uri,
    pub value: Value,
    #[serde(default = "DateTime::now_utc")]
    pub stated_at: DateTime,
    // pub mode: FactMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryReq {
    pub query: String,
    pub tx_id: TxId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateFactsReq {
    pub facts: Vec<UserFact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateFactsRes {
    pub tx_id: TxId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub uri: Uri,
    pub fields: HashMap<Uri, Value>,
    pub prior_facts: HashMap<Uri, Fact>,
    pub created_at: DateTime,
    pub last_updated_at: DateTime,
}

impl Entity {
    pub fn new(uri: Uri) -> Self {
        Self {
            uri,
            created_at: DateTime::now_utc(),
            last_updated_at: DateTime::now_utc(),
            fields: Default::default(),
            prior_facts: Default::default(),
        }
    }

    pub fn consolidate(&mut self, fact: Fact) {
        if let Some(prior_fact) = self.prior_facts.get(&fact.field) {
            if fact.stated_at >= prior_fact.stated_at {
                self.insert_fact(fact);
            }
        } else {
            self.insert_fact(fact);
        }
    }

    pub fn insert_fact(&mut self, fact: Fact) {
        self.fields.insert(fact.field.clone(), fact.value.clone());
        self.prior_facts.insert(fact.field.clone(), fact);
        self.last_updated_at = DateTime::now_utc();
    }
}
