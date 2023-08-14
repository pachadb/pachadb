extern crate console_error_panic_hook;
use log::*;
use maud::{html, Markup};
use pachadb_core::*;
use std::panic;
use worker::*;

#[event(fetch, respond_with_errors)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
    wasm_logger::init(wasm_logger::Config::default());

    let router = Router::new();

    router
				.get_async("/", |_req, ctx| async move {
					let html = html! {
						head {
							title {
								"PachaDB Simple Example"
							}
						}
						body {
							h1 {
								"PachaDB Simple Example"
							}
							(form())
						}
					};

					Response::from_html(html.into_string())
				})
		.post_async("/todos/new", |req, ctx| async move {
			info!("{:#?}", req);
			Response::ok("ok")
		})
        .run(req, env)
        .await
}

fn form() -> Markup {
	html! {
		form action="/todos/new" method="POST" {
			(input("todo"))
			(button("add", "submit"))
		}
	}
}

fn button(name: &str, kind: &str) -> Markup {
	html! {
		button type=(kind) { (name) }
	}
}

fn input(name: &str) -> Markup {
	html! {
			label for="todo" {
				span { (name) }
				input id="todo" placeholder="Something to do...";
			}
	}
}
