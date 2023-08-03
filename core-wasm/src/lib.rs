mod utils;

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
extern "C" {
}

#[derive(Debug, Clone, Hash, Eq, PartialEq, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
#[wasm_bindgen]
pub struct Uri {
    raw: String
}

#[wasm_bindgen]
impl Uri {
    #[wasm_bindgen(constructor)] 
    pub fn new(raw: String) -> Uri {
        Uri { raw }
    }

    #[wasm_bindgen(getter)]
    pub fn raw(&self) -> String {
        self.to_string()
    }

    pub fn to_string(&self) -> String {
        self.raw.clone()
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Fact {
    id: Uri,
    entity: Uri,
    field: Uri,
    source: Uri,
    value: String,
    stated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct UserFact {
    #[serde(default)]
    id: Option<Uri>,
    entity: Uri,
    field: Uri,
    source: Uri,
    value: String,
    stated_at: String,
}

#[wasm_bindgen]
impl Fact {
    #[wasm_bindgen(constructor)]
    pub fn new(obj: JsValue) -> Result<Fact, JsValue> {
        let user_fact: UserFact = serde_wasm_bindgen::from_value(obj)?;
        Ok(Self {
            id: Uri::new(format!("pachadb:fact:{}", uuid::Uuid::new_v4())),
            entity: user_fact.entity,
            field: user_fact.field,
            source: user_fact.source,
            value: user_fact.value,
            stated_at: user_fact.stated_at,
        })
    }

    #[wasm_bindgen(getter)]
    pub fn value(&self) -> String {
        self.value.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn stated_at(&self) -> String {
        self.stated_at.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn source(&self) -> String {
        self.source.to_string()
    }

    #[wasm_bindgen(getter)]
    pub fn field(&self) -> String {
        self.field.to_string()
    }

    #[wasm_bindgen(getter)]
    pub fn entity(&self) -> String {
        self.entity.to_string()
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.id.to_string()
    }
}

#[derive(Debug)]
pub struct Entity {
    pub uri: Uri,
    pub fields: HashMap<Uri, String>,
    pub prior_facts: HashMap<Uri, Fact>,
    pub created_at: DateTime<Utc>,
    pub last_updated_at: DateTime<Utc>,
}

impl Entity {
    pub fn new(uri: Uri) -> Self {
        let created_at = chrono::Utc::now();
        let mut fields = HashMap::default();
        fields.insert(Uri::new("pachadb/uri".to_string()), uri.to_string());
        fields.insert(Uri::new("pachadb/created_at".to_string()), created_at.to_rfc3339());
        Self {
            uri,
            created_at,
            last_updated_at: created_at,
            fields,
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
        self.last_updated_at = chrono::Utc::now();
        self.fields.insert(Uri::new("pachadb/last_updated_at".to_string()), self.last_updated_at.to_rfc3339());
    }
}

use gloo_utils::format::JsValueSerdeExt;
#[wasm_bindgen]
pub fn consolidate(obj : JsValue) -> Result<(), JsValue> {
    let facts: Vec<Fact> = obj.into_serde().map_err(|err| err.to_string())?;

    let facts_by_entity = facts.into_iter().fold(HashMap::new(), |mut map, fact| {
        map.entry(fact.entity.clone())
            .or_insert_with(Vec::new)
            .push(fact);
        map
    });

    for (entity_uri, facts) in facts_by_entity {
        let mut entity: Entity = Entity::new(entity_uri.clone());
        for fact in facts {
            entity.consolidate(fact);
        }
    }

    Ok(())
}
