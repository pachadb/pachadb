use crate::*;
use async_trait::async_trait;

#[async_trait(?Send)]
pub trait Consolidator {
    async fn consolidate(&self, _facts: impl Iterator<Item = &Fact>) -> PachaResult<()>;
}
