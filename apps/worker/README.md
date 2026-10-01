# PachaDB feasibility spike

Temporary Worker testing FokosDB conditional transactions and paged index queries. Not the PachaDB API. FokosDB is experimental: never store irreplaceable data here.

Run from repository root with Bun 1.4.2 and a working Node.js installation on `PATH` (Node is needed by Wrangler):

```sh
bun install --frozen-lockfile
bun run types:worker
bun run typecheck
bun run test:worker
```

The local test starts Wrangler/workerd and checks that exactly one concurrent conditional transaction wins, followed by a four-page query. `bun run deploy` deploys to `pachadb.leostera.dev` using `apps/worker/wrangler.jsonc`. **Do not deploy without first confirming the Access app and its allow policy cover the entire hostname.** Wrangler's `workers_dev` and preview URL routes are disabled. Only the account operator is allowed through Access. An unauthenticated request should be redirected to Access; a 200 response without authentication is a deployment blocker.

`POST /spike` takes `{ "run": "atomicity" }` or `{ "run": "pagination" }` and creates throwaway FokosDB items with random keys. The bounded `/graph/ingest`, `/graph/verify` and `/graph/path` endpoints are a **fixed 500-page One Piece pilot**, not a general-purpose PachaDB API. To reproduce, download/extract the XML in ignored `.fixtures/onepiece/`, run `bun packages/onepiece-fixture/src/oracle.ts 500`, authenticate with `cf access login https://pachadb.leostera.dev`, then run `bun scripts/onepiece-remote.ts 50` and `bun scripts/onepiece-remote.ts 500`. See `docs/spikes/onepiece-graph.md`. These diagnostic endpoints must be removed/replaced after the spike. No secrets, credentials or production facts belong in them.

`POST /facts/query/stream` accepts `{ "query": "(wiki:page:1439 wiki:page:link ?to)" }` and returns `application/x-ndjson`. Read each `row` event as it arrives; require the terminal `done` record before treating the result as complete. An `error` record or EOF without `done` means failure, even with HTTP 200. Run `STREAM=1 bun run test:facts` to compare full streamed result sets with the local oracle. The original `/facts/query` collects the same engine into JSON. Neither endpoint supports `asOf` yet.

On the machine used for the spike, Homebrew's default `node` is broken; use `PATH=/opt/homebrew/opt/node@24/bin:$PATH bun run test:worker`. Running Wrangler under Bun instead of Node caused local requests to hang.
