use crate::*;
use serde_derive::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Uri {
    #[wasm_bindgen(constructor)]
    pub fn new(str: String) -> Self {
        Self(str)
    }
}

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Hash, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum ValueTag {
    String,
    Uri,
}

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Hash, Serialize, Deserialize)]
#[wasm_bindgen(getter_with_clone)]
pub struct Value {
    tag: ValueTag,
    value: String,
}

#[wasm_bindgen]
impl Value {
    #[wasm_bindgen]
    pub fn string(str: &str) -> Self {
        Self {
            tag: ValueTag::String,
            value: str.to_string(),
        }
    }

    #[wasm_bindgen]
    pub fn uri(uri: Uri) -> Self {
        uri.into()
    }

    #[wasm_bindgen(getter)]
    pub fn tag(&self) -> ValueTag {
        self.tag.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn value(&self) -> String {
        self.value.clone()
    }
}

impl From<Uri> for Value {
    fn from(value: Uri) -> Self {
        Self {
            tag: ValueTag::Uri,
            value: value.to_string(),
        }
    }
}

impl ToString for Value {
    fn to_string(&self) -> String {
        self.value.to_string()
    }
}

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Hash, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct DateTime(String);

#[wasm_bindgen]
impl DateTime {
    pub fn now_utc() -> Self {
        let time = time::OffsetDateTime::now_utc();
        Self(time.to_string())
    }
}
