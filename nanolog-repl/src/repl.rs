use pachadb_nanolog::engine::{Rule, Solver, Term};
use pachadb_nanolog::parser::Parser;
use rustyline::error::ReadlineError;
use rustyline::{DefaultEditor, Result};

fn main() -> Result<()> {
    // `()` can be used when no completer is required
    let mut rl = DefaultEditor::new()?;
    #[cfg(feature = "with-file-history")]
    if rl.load_history("history.txt").is_err() {
        println!("No previous history.");
    }

    let mut facts = vec![];

    loop {
        let readline = rl.readline("nanolog :> ");
        match readline {
            Ok(line) if line.is_empty() => print!(""),
            Ok(line) => {
                rl.add_history_entry(line.as_str())?;
                let rule = Parser.parse(&line).unwrap();

                let is_fact = rule.head.args.is_empty();

                if is_fact {
                    for fact in &rule.body {
                        facts.push(Rule {
                            head: fact.clone(),
                            body: vec![],
                        });
                        println!("<: {:?}", &fact);
                    }
                } else {
                    let mut facts = facts.clone();
                    facts.push(rule);
                    let query0 = "query0".to_string();
                    for atom in Solver.solve(facts) {
                        match &atom.relation {
                            Term::Sym(s) if *s == query0 => {
                                println!("<: {:?}", &atom);
                            }
                            _ => (),
                        }
                    }
                }
            }
            Err(ReadlineError::Interrupted) => {
                println!("CTRL-C");
                break;
            }
            Err(ReadlineError::Eof) => {
                println!("CTRL-D");
                break;
            }
            Err(err) => {
                println!("Error: {:?}", err);
                break;
            }
        }
    }
    #[cfg(feature = "with-file-history")]
    rl.save_history("history.txt");
    Ok(())
}
