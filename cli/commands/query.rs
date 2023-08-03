use crate::flags::Flags;
use anyhow::*;
use reqwest::Method;
use structopt::StructOpt;

#[derive(StructOpt, Debug, Clone)]
#[structopt(
    name = "query",
    setting = structopt::clap::AppSettings::ColoredHelp,
    about = "query the database"
)]
pub struct QueryCommand {
    #[structopt(short = "h", default_value = "https://query.api.pachadb.com")]
    host: reqwest::Url,
    #[structopt(short = "q")]
    query: String,
    #[structopt(flatten)]
    flags: Flags,
}

impl QueryCommand {
    pub async fn run(self) -> Result<(), anyhow::Error> {
        let query_req = pachadb_core::QueryReq {
            query: self.query
        };

        let client = reqwest::Client::builder().gzip(true).brotli(true).build()?;

        let json = serde_json::to_string_pretty(&query_req)?;

        let res = client.request(Method::POST, self.host).body(json).send().await?;

        println!("{}", res.text().await?);

        Ok(())
    }
}
