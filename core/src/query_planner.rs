use crate::*;
use crate::nanolog::engine::{Rule, Term};

#[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub enum Scan {
    Entity(String),
    EntityField(String, String),
    Field(String),
    FieldValue(String, String),
    EntityValue(String, String),
    Value(String),
}

impl Scan {
    pub fn to_prefix(&self) -> String {
        match self {
            Self::Entity(prefix) => prefix.clone(),
            Self::EntityField(e, f) => format!("{}/{}", e, f),
            Self::Field(f) => f.clone(),
            Self::FieldValue(f, v) => format!("{}/{}", f, v),
            Self::EntityValue(e, v) => format!("{}/{}", e, v),
            Self::Value(v) => v.clone(),
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub enum QueryPlan {
    RunScan(TxId, Vec<Scan>, Box<QueryPlan>),
    Solve(Rule),
}

pub trait QueryPlanner {
    fn plan(&self, query: Rule, tx_id: TxId) -> PachaResult<QueryPlan>;
}

#[derive(Default, Debug)]
pub struct DefaultQueryPlanner;

impl QueryPlanner for DefaultQueryPlanner {
    fn plan(&self, query: Rule, tx_id: TxId) -> PachaResult<QueryPlan> {
        let scans: Vec<Scan> = query
            .body
            .iter()
            .flat_map(|atom| match &atom.relation {
                Term::Var(..) => {
                    let entity = atom.args.get(0).unwrap();
                    let value = atom.args.get(1).unwrap();
                    match (entity, value) {
                        (Term::Var(..), Term::Sym(v)) => vec![Scan::Value(v.clone())],
                        (Term::Sym(e), Term::Var(..)) => vec![Scan::Entity(e.clone())],
                        (Term::Sym(e), Term::Sym(v)) => {
                            vec![Scan::EntityValue(e.clone(), v.clone())]
                        }
                        (Term::Var(..), Term::Var(..)) => vec![],
                    }
                }
                Term::Sym(f) => {
                    let entity = atom.args.get(0).unwrap();
                    let value = atom.args.get(1).unwrap();
                    match (entity, value) {
                        (Term::Var(..), Term::Sym(v)) => {
                            vec![Scan::FieldValue(f.clone(), v.clone())]
                        }
                        (Term::Sym(e), Term::Var(..)) => {
                            vec![Scan::EntityField(e.clone(), f.clone())]
                        }
                        (Term::Sym(_), Term::Sym(_)) => vec![],
                        (Term::Var(..), Term::Var(..)) => vec![Scan::Field(f.clone())],
                    }
                }
            })
            .collect();

        Ok(QueryPlan::RunScan(
            tx_id,
            scans,
            QueryPlan::Solve(query).into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use crate::nanolog::engine::{Atom, Rule, Term};
    use crate::nanolog::parser::Parser;
    use crate::{atom, query, rule, sym, var};
    use quickcheck::Arbitrary;

    use super::*;

    /// A Range-restricted rule can be used to generate random rules where all the variables used
    /// in the head of the rule appear in the rule's body.
    ///
    /// This is typically how we create our `query0` rule for evaluating queries.
    ///
    #[derive(Debug, Clone)]
    pub struct RangeRestrictedRule(Rule);

    #[cfg(test)]
    impl quickcheck::Arbitrary for RangeRestrictedRule {
        fn arbitrary(g: &mut quickcheck::Gen) -> Self {
            let body: Vec<Atom> = (0..g.size())
                .map(|idx| {
                    let relation = Term::Sym(format!("rel-{}", idx));

                    let vars = vec![
                        Term::Var(format!("var-{}", u32::arbitrary(g))),
                        Term::Sym(format!("sym-{}", idx)),
                    ];
                    let subject = g.choose(&vars).unwrap().clone();
                    let object = g.choose(&vars).unwrap().clone();

                    let args = vec![subject, object];
                    Atom { relation, args }
                })
                .collect();

            // NOTE(@ostera): we extract all the variables that are used in the body to make sure
            // this rule is range restricted.
            let relation = Term::Sym("query0".to_string());
            let args: Vec<Term> = body
                .iter()
                .flat_map(|a| a.args.clone())
                .filter(|t| t.is_var())
                .collect();
            let head = Atom { relation, args };

            RangeRestrictedRule(Rule { head, body })
        }
    }

    impl Arbitrary for QueryPlan {
        fn arbitrary(g: &mut quickcheck::Gen) -> Self {
            let query: RangeRestrictedRule = Arbitrary::arbitrary(g);

            if !query.0.is_range_restricted() {
                panic!("Rule was not range restricted! {:#?}", query.0);
            }

            DefaultQueryPlanner.plan(query.0, TxId::default()).unwrap()
        }
    }

    #[test]
    fn plans_simple_query() {
        let planner = DefaultQueryPlanner;
        let tx_id = TxId::default();

        let rule = Parser.parse("(?who likes rush)").unwrap();
        let plan = planner.plan(rule, tx_id).unwrap();

        let query = rule!(
            query!("query0", vec![var!("who")]),
            vec![atom!(var!("who"), sym!("likes"), sym!("rush"))]
        );

        assert_eq!(
            plan,
            QueryPlan::RunScan(
                tx_id,
                vec![Scan::FieldValue("likes".to_string(), "rush".to_string())],
                QueryPlan::Solve(query).into()
            )
        );
    }

    #[test]
    fn plans_complex_query() {
        let planner = DefaultQueryPlanner;
        let tx_id = TxId::default();
        let rule = Parser
            .parse(
                r#"
            (
                ?who likes rush
                ?who likes ?band
                ?band is-a music-band
                ?band plays prog-rock
             )
            "#,
            )
            .unwrap();
        let plan = planner.plan(rule, tx_id).unwrap();

        let query = rule!(
            query!(
                "query0",
                vec![
                    var!("who"),
                    var!("who"),
                    var!("band"),
                    var!("band"),
                    var!("band"),
                ]
            ),
            vec![
                atom!(var!("who"), sym!("likes"), sym!("rush")),
                atom!(var!("who"), sym!("likes"), var!("band")),
                atom!(var!("band"), sym!("is-a"), sym!("music-band")),
                atom!(var!("band"), sym!("plays"), sym!("prog-rock")),
            ]
        );

        assert_eq!(
            plan,
            QueryPlan::RunScan(
                tx_id,
                vec![
                    Scan::FieldValue("likes".to_string(), "rush".to_string()),
                    Scan::Field("likes".to_string()),
                    Scan::FieldValue("is-a".to_string(), "music-band".to_string()),
                    Scan::FieldValue("plays".to_string(), "prog-rock".to_string())
                ],
                QueryPlan::Solve(query).into()
            )
        );
    }
}
