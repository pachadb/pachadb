#[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub enum Expr {
    Match(String, String),
    Symbol(String),
    Variable(String),
    List(Vec<Expr>),
}
