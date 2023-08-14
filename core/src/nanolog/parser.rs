use std::str::FromStr;

use super::ast::*;
use crate::atom;
use super::engine::{Atom, Rule, Term};
use lalrpop_util::lalrpop_mod;
use thiserror::*;

lalrpop_mod!(grammar, "/nanolog/grammar.rs");

#[derive(Debug, Clone)]
pub struct Parser;

impl Parser {
    pub fn parse(&self, str: &str) -> Result<Rule, ParseError> {
        let ast = grammar::ExprParser::new()
            .parse(str)
            .map_err(|err| ParseError::Grammar(err.to_string()))?;

        let Expr::List(ast) = ast else { return ParseError::unsupported("top-level query must be a list!"); };

        let mut args = vec![];
        let mut body = vec![];

        for chunk in ast.chunks(3) {
            let entity = self.expr_to_term(&chunk[0]);
            let field = self.expr_to_term(&chunk[1]);
            let value = self.expr_to_term(&chunk[2]);

            if entity.is_var() {
                args.push(entity.clone());
            }
            if field.is_var() {
                args.push(field.clone());
            }
            if value.is_var() {
                args.push(value.clone());
            }
            body.push(atom!(entity, field, value));
        }

        // make them part of our query
        let head = Atom {
            relation: Term::Sym("query0".to_string()),
            args,
        };

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
    fn unsupported(str: &str) -> Result<Rule, ParseError> {
        Err(Self::Unsupported(str.to_string()))
    }
}

impl FromStr for Rule {
    type Err = ParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Parser.parse(s)
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
    fn parse_simple_rules() {
        assert_eq!(
            Parser.parse(r#"( ?who likes Metallica )"#).unwrap(),
            rule!(
                query!("query0", vec![var!("who")]),
                vec![atom!(var!("who"), sym!("likes"), sym!("Metallica")),]
            )
        );
    }

    #[test]
    fn parse_complex_rules() {
        assert_eq!(
            Parser
                .parse(
                    r#"( ?who likes ?what
                     ?what is-a band
                     ?what playsGenre "Heavy Metal" )"#
                )
                .unwrap(),
            rule!(
                query!(
                    "query0",
                    vec![var!("who"), var!("what"), var!("what"), var!("what")]
                ),
                vec![
                    atom!(var!("who"), sym!("likes"), var!("what")),
                    atom!(var!("what"), sym!("is-a"), sym!("band")),
                    atom!(var!("what"), sym!("playsGenre"), sym!("Heavy Metal")),
                ]
            )
        );
    }
}
