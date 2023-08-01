use serde::{Serialize, Deserialize};
use worker::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Uri(String);

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Fact {
	id: Uri,
	entity: Uri,
	field: Uri,
	source: Uri,
	value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StateFactsReq {
	facts: Vec<Fact>
}

#[event(fetch)]
async fn main(req: Request, _env: Env, _ctx: Context) -> Result<Response> {
		// let json = req.json().unwrap();
		// let state_req: StateFactsReq = json.parse().unwrap();
    Response::ok(format!("ok"))
}
