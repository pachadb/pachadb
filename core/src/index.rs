use crate::*;
use async_trait::async_trait;
use serde_derive::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Serialize, Deserialize)]
pub struct IndexKeySet {
    index_by_entity: IndexKey,
    index_by_entity_field: IndexKey,
    index_by_field: IndexKey,
    index_by_field_value: IndexKey,
    index_by_value: IndexKey,
}

impl IndexKeySet {
    pub fn from_fact(fact: &Fact) -> Self {
        IndexKeySet {
            index_by_entity: IndexKey::new(
                fact.tx_id,
                fact.id.clone(),
                vec![fact.entity.clone().into()],
            ),
            index_by_entity_field: IndexKey::new(
                fact.tx_id,
                fact.id.clone(),
                vec![fact.entity.clone().into(), fact.field.clone().into()],
            ),
            index_by_field: IndexKey::new(
                fact.tx_id,
                fact.id.clone(),
                vec![fact.field.clone().into()],
            ),
            index_by_field_value: IndexKey::new(
                fact.tx_id,
                fact.id.clone(),
                vec![fact.field.clone().into(), fact.value.clone()],
            ),
            index_by_value: IndexKey::new(fact.tx_id, fact.id.clone(), vec![fact.value.clone()]),
        }
    }

    pub fn keys(self) -> Vec<IndexKey> {
        vec![
            self.index_by_entity,
            self.index_by_entity_field,
            self.index_by_field,
            self.index_by_field_value,
            self.index_by_value,
        ]
    }
}

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub struct IndexKey {
    pub tx_id: TxId,
    pub fact_uri: Uri,
    pub prefix: Vec<Value>,
}

impl IndexKey {
    pub fn new(tx_id: TxId, fact_uri: Uri, prefix: Vec<Value>) -> Self {
        Self {
            tx_id,
            fact_uri,
            prefix,
        }
    }

    pub fn starts_with(&self, prefix: impl AsRef<str>) -> bool {
        self.to_string().starts_with(prefix.as_ref())
    }
}

impl ToString for IndexKey {
    fn to_string(&self) -> String {
        let prefix = self
            .prefix
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<String>>()
            .join("/");
        format!("{}/{}", prefix, self.tx_id.0)
    }
}

impl FromStr for IndexKey {
    type Err = PachaError;

    fn from_str(_key: &str) -> Result<Self, Self::Err> {
        todo!()
    }
}

#[async_trait(?Send)]
pub trait Index: Clone {
    async fn put(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()>;

    async fn scan(&self, prefix: Scan) -> PachaResult<Box<dyn Iterator<Item = IndexKey>>>;

    async fn get(&self, key: IndexKey) -> PachaResult<Option<Uri>>;
}
