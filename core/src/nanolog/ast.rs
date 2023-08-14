#[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub enum Expr {
    Symbol(String),
    Variable(String),
    List(Vec<Expr>),
}
