- [x] intake worker: use a durable object to fetch a tx id 
- [x] intake worker: assign a tx id to every fact
- [x] intake worker: write tx[facts] to txs kv 
- [x] query worker: receive tx id, force-read facts from kv


- [ ] build a nicer abstraction for transactions
worker-intake/src/lib.rs
133:                                            // TODO(@ostera): tx.commit().await?;

- [ ] create and populate index_by_entity_value
- [x] write tx-id at the end of keys in the indices 
- [x] before fetching the fact from the index, filter by the tx-id in the name
worker-query/src/lib.rs
83:                    // TODO(@ostera): we don't have this one!
166:            // TODO(@ostera): optimize by keeping tx_id in the name
