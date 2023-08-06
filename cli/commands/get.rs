use crate::flags::Flags;
use anyhow::*;
use reqwest::Method;
use structopt::StructOpt;

#[derive(StructOpt, Debug, Clone)]
#[structopt(
    name = "get",
    setting = structopt::clap::AppSettings::ColoredHelp,
    about = "gets an entity"
)]
pub struct GetCommand {
    #[structopt(
        short = "h",
        default_value = "https://pachadb-worker.abstractmachines.workers.dev"
    )]
    host: reqwest::Url,
    #[structopt(short = "u")]
    uri: String,
    #[structopt(flatten)]
    flags: Flags,
}

impl GetCommand {
    pub async fn run(self) -> Result<(), anyhow::Error> {
        let client = reqwest::Client::builder().gzip(true).brotli(true).build()?;

        let res = client
            .request(Method::GET, format!("{}{}", self.host, self.uri))
            .send()
            .await?;
        println!("{}", res.text().await?);

        Ok(())
    }
}
