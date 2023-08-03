mod commands;
pub mod flags;

use commands::*;
use structopt::StructOpt;
use tracing::log;

#[derive(StructOpt, Debug, Clone)]
#[structopt(
    name = "pacha",
    setting = structopt::clap::AppSettings::ColoredHelp,
)]
struct Pacha {
    #[structopt(subcommand, help = "the command to run")]
    cmd: Option<Command>,
}

impl Pacha {
    async fn run(mut self) -> Result<(), anyhow::Error> {
        human_panic::setup_panic!(Metadata {
            name: "pacha".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            authors: "Leandro Ostera <leandro@abstractmachines.dev>".into(),
            homepage: "https://pachadb.com".into(),
        });

        env_logger::Builder::new()
            .filter_level(log::LevelFilter::Off)
            .format_timestamp_micros()
            .format_module_path(false)
            .parse_env("PACHA_LOG")
            .try_init()
            .unwrap();

        self.cmd.take().unwrap().run().await
    }
}

#[derive(StructOpt, Debug, Clone)]
enum Command {
    State(StateCommand),
    Get(GetCommand),
    Query(QueryCommand),
}

impl Command {
    async fn run(self) -> Result<(), anyhow::Error> {
        match self {
            Command::State(x) => x.run().await,
            Command::Get(x) => x.run().await,
            Command::Query(x) => x.run().await,
        }
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), anyhow::Error> {
    Pacha::from_args().run().await
}
