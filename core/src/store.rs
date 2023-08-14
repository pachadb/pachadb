use crate::*;
use async_trait::async_trait;

#[async_trait(?Send)]
pub trait Store: Clone {
    async fn get_tx_id(&self) -> PachaResult<TxId>;

    async fn get_next_tx_id(&self) -> PachaResult<TxId>;

    async fn get_fact(&self, uri: Uri) -> PachaResult<Option<Fact>>;

    async fn put_facts(&self, facts: impl Iterator<Item = &Fact>) -> PachaResult<()>;

    async fn put_transaction(&self, tx: &Transaction) -> PachaResult<()>;
}
