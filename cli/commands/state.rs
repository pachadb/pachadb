use crate::flags::Flags;
use anyhow::*;
use pachadb_core::{DateTime, Uri, Value};
use reqwest::Method;
use structopt::StructOpt;

#[derive(StructOpt, Debug, Clone)]
#[structopt(
    name = "state",
    setting = structopt::clap::AppSettings::ColoredHelp,
    about = "states a fact"
)]
pub struct StateCommand {
    #[structopt(
        short = "h",
        default_value = "https://pachadb-worker.abstractmachines.workers.dev"
    )]
    host: reqwest::Url,
    #[structopt(short = "e")]
    entity: String,
    #[structopt(short = "f")]
    field: String,
    #[structopt(short = "v")]
    value: String,
    #[structopt(flatten)]
    flags: Flags,
}

impl StateCommand {
    pub async fn run(self) -> Result<(), anyhow::Error> {
        let state_req = pachadb_core::StateFactsReq {
            facts: vec![pachadb_core::UserFact {
                entity: Uri(self.entity.clone()),
                field: Uri(self.field.clone()),
                source: Uri(format!("system:{}", whoami::username())),
                value: Value::string(self.value.clone()),
                stated_at: DateTime::now_utc(),
            }],
        };

        let client = reqwest::Client::builder().gzip(true).brotli(true).build()?;

        let json = serde_json::to_string_pretty(&state_req)?;

        let req = client.request(Method::POST, self.host).body(json);

        let res = req.send().await?;
        println!("{}", res.text().await?);

        Ok(())
    }
}
