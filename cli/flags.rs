use std::path::PathBuf;
use structopt::StructOpt;

#[derive(Default, Debug, Clone, StructOpt)]
pub struct Flags {
    #[structopt(help = r"Change the root of Pacha", long = "pacha-root")]
    pub(crate) pacha_root: Option<PathBuf>,
}
