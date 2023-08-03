use std::collections::HashSet;

#[derive(Clone, Hash, PartialEq, Eq, PartialOrd, Ord)]
pub enum Term {
    Var(String),
    Sym(String),
}

impl Term {
    pub fn is_var(&self) -> bool {
        matches!(&self, Self::Var(_))
    }

    pub fn is_symbol(&self) -> bool {
        matches!(&self, Self::Sym(_))
    }
}

#[derive(Default, Clone, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct Substitution {
    pub subs: Vec<(Term, Term)>,
}

impl Substitution {
    pub fn insert(&mut self, k: Term, v: Term) {
        self.subs.push((k, v));
    }

    pub fn is_empty(&self) -> bool {
        self.subs.is_empty()
    }

    pub fn find(&self, term: &Term) -> Option<Term> {
        self.subs
            .iter()
            .find(|t| t.0 == *term)
            .map(|(_, x)| x.clone())
    }

    pub fn prepend(mut self, k: Term, v: Term) -> Self {
        let mut subs = vec![(k, v)];
        subs.extend(self.subs);
        self.subs = subs;
        self
    }

    pub fn concat(mut self, other: Substitution) -> Self {
        self.subs.extend(other.subs);
        self
    }

    pub fn subs(self) -> Vec<(Term, Term)> {
        self.subs
    }
}

#[derive(Clone, Hash, Eq, PartialEq, Ord, PartialOrd)]
pub struct Atom {
    pub relation: Term,
    pub args: Vec<Term>,
}

impl Atom {
    pub fn unify(&self, other: &Atom) -> Option<Substitution> {
        if self.relation == other.relation && self.args.len() == other.args.len() {
            self.do_unify(self.args.iter().zip(other.args.iter()))
        } else {
            None
        }
    }

    fn do_unify<'a>(
        &'a self,
        mut iter: impl Iterator<Item = (&'a Term, &'a Term)>,
    ) -> Option<Substitution> {
        let next = iter.next();
        let Some((a, b)) = next else { return Some(Substitution::default()) };

        match (a, b) {
            // we have values on both sides, they must match
            (Term::Sym(a), Term::Sym(b)) => {
                if a == b {
                    self.do_unify(iter)
                } else {
                    None
                }
            }

            // we have a variable that is unified to a symbol
            (v @ Term::Var(_), s1 @ Term::Sym(_)) => {
                let inc_sub = self.do_unify(iter)?;
                let find = inc_sub.find(v);
                match find {
                    Some(s2) if *s1 != s2 => None,
                    _ => Some(inc_sub.prepend(v.clone(), s1.clone())),
                }
            }

            // everything else is unsupported
            (_, Term::Var(_)) => panic!("we expect the right side atoms to be grounded!"),
        }
    }

    pub fn substitute(mut self, sub: &Substitution) -> Self {
        self.args.iter_mut().for_each(|arg| {
            if arg.is_var() {
                if let Some(new_term) = sub.find(arg) {
                    *arg = new_term;
                }
            }
        });

        self
    }

    fn vars(&self) -> HashSet<Term> {
        let mut vars = HashSet::default();

        for arg in &self.args {
            if arg.is_var() {
                vars.insert(arg.clone());
            }
        }

        vars
    }
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct Rule {
    pub head: Atom,
    pub body: Vec<Atom>,
}

impl Rule {
    pub fn is_range_restricted(&self) -> bool {
        let body_vars = self.body.iter().fold(HashSet::default(), |mut acc, atom| {
            acc.extend(atom.vars());
            acc
        });
        self.head.vars().is_subset(&body_vars)
    }
}

#[derive(Default, Debug, Clone)]
pub struct Solver;

impl Solver {
    pub fn solve(&self, rules: Vec<Rule>) -> Vec<Atom> {
        if rules.iter().all(Rule::is_range_restricted) {
            return self.step(rules, HashSet::default()).into_iter().collect();
        }
        panic!("we had rules that are not range restricted whyyyy")
    }

    fn step(&self, rules: Vec<Rule>, kb: HashSet<Atom>) -> HashSet<Atom> {
        let next_kb = self.immediate_consequence(&rules, &kb);
        if next_kb == kb {
            return next_kb;
        }
        self.step(rules, next_kb)
    }

    fn immediate_consequence(&self, rules: &[Rule], kb: &HashSet<Atom>) -> HashSet<Atom> {
        let mut new_kb: HashSet<Atom> = kb.iter().cloned().collect();

        for rule in rules {
            let new_facts = self.eval_rule(rule, kb);
            new_kb.extend(new_facts);
        }

        new_kb
    }

    pub fn eval_rule(&self, rule: &Rule, kb: &HashSet<Atom>) -> Vec<Atom> {
        let walked_body = rule
            .body
            .iter()
            .rfold(vec![Substitution::default()], |subs, atom| {
                self.eval_atom(kb, subs, atom)
            });

        walked_body
            .iter()
            .map(|sub| rule.head.clone().substitute(sub))
            .collect()
    }

    pub fn eval_atom(
        &self,
        kb: &HashSet<Atom>,
        subs: Vec<Substitution>,
        atom: &Atom,
    ) -> Vec<Substitution> {
        subs.iter()
            .flat_map(|sub| {
                let lowered_atom = atom.clone().substitute(sub);

                kb.iter()
                    .filter_map(|kb_atom| lowered_atom.unify(kb_atom))
                    .map(|sub2| sub.clone().concat(sub2))
                    .collect::<Vec<Substitution>>()
            })
            .collect()
    }
}

struct QueryPlanner {}

impl QueryPlanner {}

impl std::fmt::Debug for Term {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Term::Var(x) => write!(f, "{}", x),
            Term::Sym(s) => write!(f, "{}", s),
        }
    }
}

impl std::fmt::Debug for Atom {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let args = self
            .args
            .iter()
            .map(|arg| format!("{:?}", arg))
            .collect::<Vec<String>>()
            .join(", ");
        write!(f, "{:?}({})", self.relation, args)
    }
}

impl std::fmt::Debug for Substitution {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let subs = self
            .subs
            .iter()
            .map(|(k, v)| format!("{:?}={:?}", k, v))
            .collect::<Vec<String>>()
            .join(", ");
        write!(f, "[{}]", subs)
    }
}

impl std::fmt::Debug for Rule {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self.head)?;
        if !self.body.is_empty() {
            let body = self
                .body
                .iter()
                .map(|b| format!("{:?}", b))
                .collect::<Vec<String>>()
                .join(", ");
            write!(f, " :- {}", body)?;
        }
        write!(f, ".")
    }
}

#[macro_export]
macro_rules! sym {
    ($term:expr) => {
        Term::Sym($term.to_string())
    };
}

#[macro_export]
macro_rules! var {
    ($term:expr) => {
        Term::Var(format!("?{}", $term))
    };
}

#[macro_export]
macro_rules! atom {
    ($e:expr, $r:expr, $v:expr) => {
        Atom {
            relation: $r,
            args: vec![$e, $v],
        }
    };
}

#[macro_export]
macro_rules! fact {
    ($e:expr, $f:expr, $v:expr) => {
        Atom {
            relation: sym!($f),
            args: vec![sym!($e), sym!($v)],
        }
    };
}

#[macro_export]
macro_rules! query {
    ($name:expr, $args:expr) => {
        Atom {
            relation: sym!($name),
            args: $args,
        }
    };
}

#[macro_export]
macro_rules! rule {
    ($h:expr, $b:expr) => {
        Rule { head: $h, body: $b }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fact_unification() {
        let fact_atom = atom!(var!("who"), sym!("likes"), sym!("metallica"));
        let fact = fact!("leandro", "likes", "metallica");
        let unif = fact_atom.unify(&fact).unwrap();
        assert_eq!(unif.subs, vec![(var!("who"), sym!("leandro"))]);

        let fact_atom = atom!(sym!("leandro"), sym!("likes"), var!("band"));
        let fact = fact!("leandro", "likes", "metallica");
        let unif = fact_atom.unify(&fact).unwrap();
        assert_eq!(unif.subs, vec![(var!("band"), sym!("metallica"))]);

        let fact_atom = atom!(sym!("leandro"), sym!("likes"), sym!("band"));
        let fact = fact!("leandro", "likes", "metallica");
        let unif = fact_atom.unify(&fact);
        assert!(unif.is_none());

        let fact_atom = atom!(sym!("leandro"), sym!("likes"), sym!("metallica"));
        let fact = fact!("leandro", "likes", "metallica");
        let unif = fact_atom.unify(&fact).unwrap();
        assert_eq!(unif, Substitution::default());
    }

    #[test]
    fn fact_substitution() {
        let fact_atom = atom!(var!("who"), sym!("likes"), sym!("metallica"));
        let fact = fact!("leandro", "likes", "metallica");
        let sub = fact_atom.unify(&fact).unwrap();
        let fact_atom2 = fact_atom.substitute(&sub);

        assert_eq!(fact_atom2.relation, sym!("likes"));
        assert_eq!(fact_atom2.args, vec![sym!("leandro"), sym!("metallica")]);
    }

    #[test]
    fn range_restriction() {
        let rule = rule!(
            atom!(var!("a"), sym!("ancestor"), var!("c")),
            vec![
                atom!(var!("a"), sym!("parent"), var!("b")),
                atom!(var!("b"), sym!("ancestor"), var!("c")),
            ]
        );
        assert!(rule.is_range_restricted());

        let rule = rule!(
            atom!(var!("a"), sym!("ancestor"), var!("c")),
            vec![
                atom!(var!("a"), sym!("parent"), var!("b")),
                atom!(var!("b"), sym!("ancestor"), var!("a")),
            ]
        );
        assert!(!rule.is_range_restricted());
    }

    #[test]
    fn solver_evaluates_simple_rules() {
        let solver = Solver::default();
        let kb = vec![
            atom!(sym!("1"), sym!("lessThan"), sym!("2")),
            atom!(sym!("2"), sym!("lessThan"), sym!("3")),
            atom!(sym!("3"), sym!("lessThan"), sym!("4")),
        ]
        .into_iter()
        .collect();

        let mut new_facts = solver.eval_rule(
            &rule!(
                atom!(var!("X"), sym!("muchLessThan"), var!("Y")),
                vec![atom!(var!("X"), sym!("lessThan"), var!("Y"))]
            ),
            &kb,
        );
        new_facts.sort_unstable();
        assert_eq!(
            new_facts,
            vec![
                atom!(sym!("1"), sym!("muchLessThan"), sym!("2")),
                atom!(sym!("2"), sym!("muchLessThan"), sym!("3")),
                atom!(sym!("3"), sym!("muchLessThan"), sym!("4")),
            ]
        );
    }

    fn solver_evaluates_recursive_rule() {
        let solver = Solver::default();

        let kb = vec![
            atom!(sym!("1"), sym!("lessThan"), sym!("2")),
            atom!(sym!("2"), sym!("lessThan"), sym!("3")),
            atom!(sym!("3"), sym!("lessThan"), sym!("4")),
            atom!(var!("X"), sym!("muchLessThan"), var!("Y")),
            atom!(sym!("1"), sym!("muchLessThan"), sym!("2")),
            atom!(sym!("2"), sym!("muchLessThan"), sym!("3")),
            atom!(sym!("3"), sym!("muchLessThan"), sym!("4")),
        ]
        .into_iter()
        .collect();

        let new_facts = solver.eval_rule(
            &rule!(
                atom!(var!("X"), sym!("muchLessThan"), var!("Z")),
                vec![
                    atom!(var!("X"), sym!("lessThan"), var!("Y")),
                    atom!(var!("Y"), sym!("muchLessThan"), var!("Z")),
                ]
            ),
            &kb,
        );

        assert_eq!(new_facts, vec![]);
    }

    macro_rules! adviser {
        ($a:expr, $b:expr) => {
            Rule {
                head: Atom {
                    relation: sym!("adviser"),
                    args: vec![sym!($a.to_string()), sym!($b.to_string())],
                },
                body: vec![],
            }
        };
    }

    macro_rules! academicAncestor {
        ($a:expr, $b:expr) => {
            Rule {
                head: Atom {
                    relation: sym!("academicAncestor"),
                    args: vec![sym!($a.to_string()), sym!($b.to_string())],
                },
                body: vec![],
            }
        };
    }

    #[test]
    fn solve_ancestor_direct_rule() {
        let rules = vec![
            adviser!("Andrew Rice", "Mistral Contrastin"),
            adviser!("Dominic Orchard", "Mistral Contrastin"),
            adviser!("Andy Hopper", "Andrew Rice"),
            adviser!("Alan Mycroft", "Dominic Orchard"),
            adviser!("David Wheeler", "Andy Hopper"),
            adviser!("Rod Burstall", "Alan Mycroft"),
            adviser!("Robin Milner", "Alan Mycroft"),
            // academicAncestor(X, Y) :- adviser(X, Y).,
            rule!(
                atom!(var!("X"), sym!("academicAncestor"), var!("Y")),
                vec![atom!(var!("X"), sym!("adviser"), var!("Y"))]
            ),
        ];

        let solver = Solver::default();
        let mut result = solver.solve(rules);
        result.sort_unstable();
        assert_eq!(
            result,
            vec![
                academicAncestor!("Alan Mycroft", "Dominic Orchard").head,
                academicAncestor!("Andrew Rice", "Mistral Contrastin").head,
                academicAncestor!("Andy Hopper", "Andrew Rice").head,
                academicAncestor!("David Wheeler", "Andy Hopper").head,
                academicAncestor!("Dominic Orchard", "Mistral Contrastin").head,
                academicAncestor!("Robin Milner", "Alan Mycroft").head,
                academicAncestor!("Rod Burstall", "Alan Mycroft").head,
                adviser!("Alan Mycroft", "Dominic Orchard").head,
                adviser!("Andrew Rice", "Mistral Contrastin").head,
                adviser!("Andy Hopper", "Andrew Rice").head,
                adviser!("David Wheeler", "Andy Hopper").head,
                adviser!("Dominic Orchard", "Mistral Contrastin").head,
                adviser!("Robin Milner", "Alan Mycroft").head,
                adviser!("Rod Burstall", "Alan Mycroft").head,
            ]
        );
    }

    #[test]
    fn solve_ancestor_recursive_rule() {
        let rules = vec![
            adviser!("Andrew Rice", "Mistral Contrastin"),
            adviser!("Dominic Orchard", "Mistral Contrastin"),
            adviser!("Andy Hopper", "Andrew Rice"),
            adviser!("Alan Mycroft", "Dominic Orchard"),
            adviser!("David Wheeler", "Andy Hopper"),
            adviser!("Rod Burstall", "Alan Mycroft"),
            adviser!("Robin Milner", "Alan Mycroft"),
            // academicAncestor(X, Y) :- adviser(X, Y).
            rule!(
                atom!(var!("X"), sym!("academicAncestor"), var!("Y")),
                vec![atom!(var!("X"), sym!("adviser"), var!("Y"))]
            ),
            // academicAncestor(X, Z) :- adviser(X, Y), academicAncestor(Y, Z).
            rule!(
                atom!(var!("X"), sym!("academicAncestor"), var!("Z")),
                vec![
                    atom!(var!("X"), sym!("adviser"), var!("Y")),
                    atom!(var!("Y"), sym!("academicAncestor"), var!("Z")),
                ]
            ),
        ];

        let solver = Solver::default();
        let mut result = solver.solve(rules);
        result.sort_unstable();
        assert_eq!(
            result,
            vec![
                academicAncestor!("Alan Mycroft", "Dominic Orchard").head,
                academicAncestor!("Alan Mycroft", "Mistral Contrastin").head,
                academicAncestor!("Andrew Rice", "Mistral Contrastin").head,
                academicAncestor!("Andy Hopper", "Andrew Rice").head,
                academicAncestor!("Andy Hopper", "Mistral Contrastin").head,
                academicAncestor!("David Wheeler", "Andrew Rice").head,
                academicAncestor!("David Wheeler", "Andy Hopper").head,
                academicAncestor!("David Wheeler", "Mistral Contrastin").head,
                academicAncestor!("Dominic Orchard", "Mistral Contrastin").head,
                academicAncestor!("Robin Milner", "Alan Mycroft").head,
                academicAncestor!("Robin Milner", "Dominic Orchard").head,
                academicAncestor!("Robin Milner", "Mistral Contrastin").head,
                academicAncestor!("Rod Burstall", "Alan Mycroft").head,
                academicAncestor!("Rod Burstall", "Dominic Orchard").head,
                academicAncestor!("Rod Burstall", "Mistral Contrastin").head,
                adviser!("Alan Mycroft", "Dominic Orchard").head,
                adviser!("Andrew Rice", "Mistral Contrastin").head,
                adviser!("Andy Hopper", "Andrew Rice").head,
                adviser!("David Wheeler", "Andy Hopper").head,
                adviser!("Dominic Orchard", "Mistral Contrastin").head,
                adviser!("Robin Milner", "Alan Mycroft").head,
                adviser!("Rod Burstall", "Alan Mycroft").head,
            ]
        );
    }

    #[test]
    fn solve_query_ancestor() {
        let rules = vec![
            adviser!("Andrew Rice", "Mistral Contrastin"),
            adviser!("Dominic Orchard", "Mistral Contrastin"),
            adviser!("Andy Hopper", "Andrew Rice"),
            adviser!("Alan Mycroft", "Dominic Orchard"),
            adviser!("David Wheeler", "Andy Hopper"),
            adviser!("Rod Burstall", "Alan Mycroft"),
            adviser!("Robin Milner", "Alan Mycroft"),
            // academicAncestor(X, Y) :- adviser(X, Y).
            rule!(
                atom!(var!("X"), sym!("academicAncestor"), var!("Y")),
                vec![atom!(var!("X"), sym!("adviser"), var!("Y"))]
            ),
            // academicAncestor(X, Z) :- adviser(X, Y), academicAncestor(Y, Z).
            rule!(
                atom!(var!("X"), sym!("academicAncestor"), var!("Z")),
                vec![
                    atom!(var!("X"), sym!("adviser"), var!("Y")),
                    atom!(var!("Y"), sym!("academicAncestor"), var!("Z")),
                ]
            ),
            // query!(I) :- academicAncestor("Robin Milner", I), academicAncestor(I, "Mistral Contrastin").
            rule!(
                query!("query1", vec![var!("Im")]),
                vec![
                    atom!(sym!("Robin Milner"), sym!("academicAncestor"), var!("Im")),
                    atom!(
                        var!("Im"),
                        sym!("academicAncestor"),
                        sym!("Mistral Contrastin")
                    ),
                ]
            ),
        ];

        let solver = Solver::default();
        let mut result = solver.solve(rules);
        result.sort_unstable();
        assert_eq!(
            result,
            vec![
                academicAncestor!("Alan Mycroft", "Dominic Orchard").head,
                academicAncestor!("Alan Mycroft", "Mistral Contrastin").head,
                academicAncestor!("Andrew Rice", "Mistral Contrastin").head,
                academicAncestor!("Andy Hopper", "Andrew Rice").head,
                academicAncestor!("Andy Hopper", "Mistral Contrastin").head,
                academicAncestor!("David Wheeler", "Andrew Rice").head,
                academicAncestor!("David Wheeler", "Andy Hopper").head,
                academicAncestor!("David Wheeler", "Mistral Contrastin").head,
                academicAncestor!("Dominic Orchard", "Mistral Contrastin").head,
                academicAncestor!("Robin Milner", "Alan Mycroft").head,
                academicAncestor!("Robin Milner", "Dominic Orchard").head,
                academicAncestor!("Robin Milner", "Mistral Contrastin").head,
                academicAncestor!("Rod Burstall", "Alan Mycroft").head,
                academicAncestor!("Rod Burstall", "Dominic Orchard").head,
                academicAncestor!("Rod Burstall", "Mistral Contrastin").head,
                adviser!("Alan Mycroft", "Dominic Orchard").head,
                adviser!("Andrew Rice", "Mistral Contrastin").head,
                adviser!("Andy Hopper", "Andrew Rice").head,
                adviser!("David Wheeler", "Andy Hopper").head,
                adviser!("Dominic Orchard", "Mistral Contrastin").head,
                adviser!("Robin Milner", "Alan Mycroft").head,
                adviser!("Rod Burstall", "Alan Mycroft").head,
                query!("query1", vec![sym!("Alan Mycroft")]),
                query!("query1", vec![sym!("Dominic Orchard")]),
            ]
        );
    }
}
