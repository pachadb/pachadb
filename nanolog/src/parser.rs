use crate::ast::*;
use crate::engine::{Atom, Rule, Term};
use lalrpop_util::lalrpop_mod;
use thiserror::*;

lalrpop_mod!(grammar);

#[derive(Debug, Clone)]
pub struct Parser;

impl Parser {
    pub fn parse(&self, str: &str) -> Result<Vec<Rule>, ParseError> {
        let ast = grammar::ExprParser::new()
            .parse(str)
            .map_err(|err| ParseError::Grammar(err.to_string()))?;

        let Expr::List(ast) = ast else { return ParseError::unsupported("top-level query must be a list!"); };

        let mut rules = vec![];

        let mut curr = vec![];
        for expr in ast {
            curr.push(expr);
            if curr.len() == 3 {
                rules.push(self.build_rule(curr)?);
                break;
            }
        }

        Ok(rules)
    }

    fn build_rule(&self, curr: Vec<Expr>) -> Result<Rule, ParseError> {
        let entity = self.expr_to_term(curr.get(0).unwrap());
        let field = self.expr_to_term(curr.get(1).unwrap());
        let value = self.expr_to_term(curr.get(2).unwrap());

        // find all the variables
        let mut args = vec![];
        if entity.is_var() {
            args.push(entity.clone());
        }
        if field.is_var() {
            args.push(field.clone());
        }
        if value.is_var() {
            args.push(value.clone());
        }

        // make them part of our query
        let head = Atom {
            relation: Term::Sym("query0".to_string()),
            args,
        };

        // include all the predicates in the body
        let body = vec![Atom {
            relation: field,
            args: vec![entity, value],
        }];

        Ok(Rule { head, body })
    }

    fn expr_to_term(&self, expr: &Expr) -> Term {
        match expr {
            Expr::Symbol(s) => Term::Sym(s.to_string()),
            Expr::Variable(v) => Term::Var(v.to_string()),
            Expr::List(_) => unimplemented!(),
        }
    }
}

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Unsupported: {0}")]
    Unsupported(String),

    #[error("Parse error: {0}")]
    Grammar(String),
}

impl ParseError {
    fn unsupported(str: &str) -> Result<Vec<Rule>, ParseError> {
        Err(Self::Unsupported(str.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{atom, query, rule, sym, var};

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

    #[test]
    fn parse_lists() {
        assert_eq!(
            parse!("(?who likes metallica)"),
            Expr::List(vec![
                Expr::Variable("?who".to_string()),
                Expr::Symbol("likes".to_string()),
                Expr::Symbol("metallica".to_string())
            ])
        );

        assert_eq!(
            parse!(
                r#"( ?who likes ?what
                     ?what is-a band
                     ?what playsGenre "Heavy Metal" )"#
            ),
            Expr::List(vec![
                Expr::Variable("?who".to_string()),
                Expr::Symbol("likes".to_string()),
                Expr::Variable("?what".to_string()),
                Expr::Variable("?what".to_string()),
                Expr::Symbol("is-a".to_string()),
                Expr::Symbol("band".to_string()),
                Expr::Variable("?what".to_string()),
                Expr::Symbol("playsGenre".to_string()),
                Expr::Symbol("Heavy Metal".to_string())
            ])
        );
    }

    #[test]
    fn parse_rules() {
        assert_eq!(
            Parser.parse(r#"( ?who likes Metallica )"#).unwrap(),
            vec![rule!(
                query!("query0", vec![var!("?who")]),
                vec![atom!(var!("?who"), sym!("likes"), sym!("Metallica")),]
            )]
        );
    }
}
