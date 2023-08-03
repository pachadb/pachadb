use lalrpop_util::lalrpop_mod;

lalrpop_mod!(grammar);

#[cfg(test)]
mod tests {
    use super::*;
use crate::ast::*;

    macro_rules! parse {
        ($e:expr) => {
            grammar::ExprParser::new().parse($e).unwrap()
        };
    }

    #[test]
    fn parse_symbol() {
        assert_eq!(parse!("hello"), Expr::Symbol("hello".to_string()));
        assert_eq!(parse!("hel/lo"), Expr::Symbol("hel/lo".to_string()));
        assert_eq!(parse!("hel-lo"), Expr::Symbol("hel-lo".to_string()));
        assert_eq!(parse!("hel.lo"), Expr::Symbol("hel.lo".to_string()));
        assert_eq!(parse!("hel_lo"), Expr::Symbol("hel_lo".to_string()));
    }

    #[test]
    fn parse_variable() {
        assert_eq!(parse!("?hello"), Expr::Variable("?hello".to_string()));
        assert_eq!(parse!("?0"), Expr::Variable("?0".to_string()));
        assert_eq!(parse!("?heLo1"), Expr::Variable("?heLo1".to_string()));
    }
}
