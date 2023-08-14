use pachadb_nanolog::parser::ParseError;
use thiserror::*;

#[derive(Error, Debug)]
pub enum PachaError {
    #[error("Unrecoverable storage errror. Reason: {0}")]
    UnrecoverableStorageError(String),

    #[error(transparent)]
    QueryParsingError(ParseError),

    #[error(transparent)]
    Unknown(anyhow::Error),
}

impl From<ParseError> for PachaError {
    fn from(value: ParseError) -> Self {
        Self::QueryParsingError(value)
    }
}

pub type PachaResult<V> = std::result::Result<V, PachaError>;
