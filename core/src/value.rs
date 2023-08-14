use crate::*;
use serde_derive::{Deserialize, Serialize};

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub enum Value {
    String(String),
    Uri(Uri),
}

impl Value {
    pub fn string(str: impl AsRef<str>) -> Self {
        Self::String(str.as_ref().to_string())
    }
    pub fn uri(uri: Uri) -> Self {
        uri.into()
    }
}

impl From<Uri> for Value {
    fn from(value: Uri) -> Self {
        Self::Uri(value)
    }
}

impl ToString for Value {
    fn to_string(&self) -> String {
        match self {
            Value::String(s) => s.to_string(),
            Value::Uri(u) => u.to_string(),
        }
    }
}

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub struct DateTime(time::OffsetDateTime);

impl DateTime {
    pub fn now_utc() -> Self {
        Self(time::OffsetDateTime::now_utc())
    }
}
