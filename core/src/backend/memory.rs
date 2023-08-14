use crate::*;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Default, Clone, Debug)]
pub struct InMemoryStore {
    tx_id: Arc<RwLock<TxId>>,
    facts: Arc<RwLock<HashMap<Uri, Fact>>>,
    txs: Arc<RwLock<Vec<Transaction>>>,
}

#[async_trait(?Send)]
impl Store for InMemoryStore {
    async fn get_tx_id(&self) -> PachaResult<TxId> {
        let tx_id = self.tx_id.read().unwrap();
        Ok(*tx_id)
    }

    async fn get_next_tx_id(&self) -> PachaResult<TxId> {
        let curr_tx_id = *self.tx_id.read().unwrap();
        let mut next_tx_id = self.tx_id.write().unwrap();
        *next_tx_id = curr_tx_id.next();
        debug!("next_tx_id: {:?} -> {:?}", curr_tx_id, next_tx_id);
        Ok(curr_tx_id)
    }

    async fn put_facts(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
        let mut fact_map = self.facts.write().unwrap();
        for fact in facts {
            debug!("writing fact: {:?}", &fact.id);
            fact_map.insert(fact.id.clone(), fact.clone());
        }
        Ok(())
    }

    async fn put_transaction(&self, tx: &Transaction) -> PachaResult<()> {
        self.txs.write().unwrap().push(tx.clone());
        Ok(())
    }

    async fn get_fact(&self, uri: Uri) -> PachaResult<Option<Fact>> {
        Ok(self.facts.read().unwrap().get(&uri).cloned())
    }
}

#[derive(Default, Clone, Debug)]
pub struct InMemoryIndex {
    // NOTE(@ostera): very naive in-memory index. Would be best to use a prefix trie for scans.
    idx: Arc<RwLock<HashMap<IndexKey, Uri>>>,
}

#[async_trait(?Send)]
impl Index for InMemoryIndex {
    async fn put(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
        let mut idx = self.idx.write().unwrap();
        for fact in facts {
            for key in IndexKeySet::from_fact(fact).keys() {
                idx.insert(key, fact.id.clone());
            }
        }
        Ok(())
    }

    async fn scan(&self, scan: Scan) -> PachaResult<Box<dyn Iterator<Item = IndexKey>>> {
        let prefix = scan.to_prefix();
        let mut keys = vec![];
        for key in self.idx.read().unwrap().keys() {
            if key.starts_with(&prefix) {
                keys.push(key.clone());
            }
        }
        Ok(Box::new(keys.into_iter()))
    }

    async fn get(&self, key: IndexKey) -> PachaResult<Option<Uri>> {
        Ok(self.idx.read().unwrap().get(&key).cloned())
    }
}

#[derive(Default)]
pub struct InMemoryConsolidator {
    entities: Arc<RwLock<HashMap<Uri, Entity>>>,
}

#[async_trait(?Send)]
impl Consolidator for InMemoryConsolidator {
    async fn consolidate(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()> {
        let mut entities = self.entities.write().unwrap();

        let facts_by_entity = facts.into_iter().fold(HashMap::new(), |mut map, fact| {
            map.entry(fact.entity.clone())
                .or_insert_with(Vec::new)
                .push(fact);
            map
        });

        for (entity_uri, facts) in facts_by_entity {
            info!("Consolidating entity {:?}", &entity_uri);
            let mut entity = (*entities)
                .get(&entity_uri)
                .cloned()
                .unwrap_or_else(|| Entity::new(entity_uri.clone()));

            for fact in facts {
                entity.consolidate(fact.clone());
            }

            entities.insert(entity_uri, entity);
        }

        Ok(())
    }
}
