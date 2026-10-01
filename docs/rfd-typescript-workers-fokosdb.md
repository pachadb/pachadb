# RFD: Port PachaDB to TypeScript on Cloudflare Workers and FokosDB

- **Status:** Proposed
- **Date:** 2026-09-30
- **Scope:** A new TypeScript implementation of PachaDB's fact store and query engine in a Bun workspace, deployed on Cloudflare Workers, backed by FokosDB

## Summary

Build PachaDB as a typed, embeddable query/domain library plus a Worker API. Use Effect for application services, failures, and dependency injection; Effect v4's Schema for validation and serialization; and FokosDB for durable facts and query access paths. FokosDB itself runs on Durable Objects (DOs). Add a PachaDB-specific DO only if a measured requirement for serial transaction-number allocation or coordination cannot be met with conditional FokosDB writes.

This is a behavioral port, **not** a translation of Rust modules or of the existing Cloudflare KV/Queues implementation. Preserve the intended immutable-facts and Datalog model, while explicitly repairing incomplete or ambiguous semantics before calling the port compatible.

## Motivation and current state

PachaDB stores facts `(entity, field, value, source, stated_at)` with a transaction ID; its public Rust API exposes `state(facts)` and `query(queryText)`. `core/src/` contains the model, parser, planner, solver, transaction manager, index and memory backend. `backend-cloudflare/` and `examples/worker-*/` explore Cloudflare deployment.

The existing implementation is not a production behavior specification:

- `backend-cloudflare/src/lib.rs` leaves `get_tx_id` and `get_fact` unimplemented. Indexing and consolidation go through queues and KV, so they cannot provide atomic read-after-write indexing.
- `core/src/tx_manager.rs` allocates a transaction number before writing facts, the transaction record, index entries and consolidation in separate operations. A failure can leave partial commits or gaps; `fact_ids` is currently empty.
- `core/src/index.rs` leaves index-key parsing unimplemented. Its string prefixes have no escaping or component boundary, and the Cloudflare `scan` implementation reads only the field-value KV namespace regardless of scan type.
- `core/src/query_executor.rs` uses `key.tx_id < tx_id`; the Worker query example uses `<=`. This and `get_tx_id`/`get_next_tx_id` semantics disagree about what an `as-of` boundary includes.
- The README describes `as-of` queries, but the core public `query` method accepts only query text. Retraction exists as a model enum, not a working API. The parser and solver also have unsupported/error-prone cases.

The port should retain **append-only fact history**, basic multi-pattern joins and time-travel by commit ID. It should not claim feature parity for incomplete or merely described features.

## Goals

1. Run an HTTP API in Workers with no Rust/WASM dependency for the server path.
2. Implement atomic, acknowledged writes of a bounded batch of facts and the indexes needed to query them; successful responses are immediately queryable.
3. Support deterministic `asOf` commit IDs and document their inclusive boundary.
4. Preserve the existing query syntax for supported triple patterns and variable joins, with fixtures against the Rust memory backend where its behavior is well-defined.
5. Make the pure engine runnable in Node and, where practical, the browser; isolate the Worker/FokosDB adapter.
6. Validate untrusted input and persisted data with Schema, use typed domain errors, and compile with maximal practical TypeScript strictness.
7. Organize the new implementation as a Bun-managed workspace with explicit package boundaries and one lockfile.

## Non-goals (initial release)

- Automatic migration of existing Cloudflare KV data, production durability guarantees beyond FokosDB's own, distributed cross-database queries, or arbitrary full-database scans.
- Retractions, consolidation/materialized entities, recursive user-authored rules, or general-purpose SQL/Datalog optimization. Decide these separately after the vertical slice works.
- A browser-side FokosDB client: `fokosdb/client` is a **Worker-side** client; browser access goes through the Worker API.

## Proposed architecture

```text
HTTP Worker (Schema decode, auth, request limits, response encoding)
       │
       ▼
PachaDB service (Effect: state, query, snapshot watermark)
       ├── pure parser / planner / join evaluator
       └── FactRepository interface (batch commit, keyed paged scan, head read)
                         │
                         ▼
                FokosDB adapter (fokosdb/client)
                         │
                         ▼
         FokosDB PartitionDO + TransactionCoordinatorDO
```

Keep the parser and evaluator pure; their functions should return typed parse/plan/evaluation failures instead of throwing on malformed queries. Keep Effect at I/O and application boundaries rather than requiring every tight inner join loop to allocate effects. The repository interface must represent **atomic commit** and **paged bounded index scan**, not the old independent `Store`, `Index` and `Consolidator` writes.

Deploy the FokosDB DO classes and re-export them from the Worker's entry module as its documentation requires. Configure both as SQLite-backed DO migrations. Use generated Cloudflare binding types, current compatibility date, logs and traces. No PachaDB DO is required merely because FokosDB uses DOs. A per-database sequencer DO is an option only after comparing it against a FokosDB conditional-write/CAS loop; either choice creates a per-database serialization point and must be load-tested. Never route *all* customers through one global DO.

## Bun workspace and repository layout

Adopt Bun as the **workspace package manager and local script runner**, not as the production runtime. The deployable app runs in Cloudflare `workerd`; Worker tests must run in workerd through the Cloudflare Vitest integration (invoked by Bun scripts), not just `bun test`. Keep package code compatible with the standard Web APIs used by Workers: no `bun:*` imports or Bun-only globals in shared packages or the Worker.

Proposed layout, introduced incrementally alongside the existing Rust Cargo workspace:

```text
package.json                 # private root, explicit workspaces and orchestration scripts
bun.lock                     # committed; use frozen installs in CI
packages/
  core/                      # pure model, Schemas, parser, planner, join evaluator
  repository/                # Effect service contract and application use cases
  fokosdb/                   # Worker-only FokosDB adapter and storage codecs
  client/                    # optional HTTP client; no FokosDB or Worker bindings
apps/
  worker/                    # HTTP entrypoint, FokosDB DO re-exports, wrangler.jsonc, workerd tests
Cargo.toml + existing Rust crates and examples/  # unchanged during the port
```

Root `workspaces` lists only new `packages/*` and `apps/*` (or explicit members): existing `examples/**/package.json` are **not** automatically swept into Bun's dependency graph. Each package is private initially and exposes a narrow `exports` map and declaration types; use `workspace:*` for internal dependencies. The dependency direction is `core <- repository <- fokosdb <- worker`, with `client` depending only on shared API contracts as needed. Keep FokosDB and Cloudflare imports out of `core`, `repository` and `client`. Put Wrangler config, DO migrations, generated binding types and Worker integration tests in `apps/worker`.

The root scripts should provide `bun run typecheck`, `bun run test`, `bun run test:worker`, `bun run build`, and `bun run dev`; make the Worker scripts delegate to Wrangler/Vitest rather than Bun's runtime. Pin Bun in CI and contributor tooling, commit `bun.lock`, and use `bun install --frozen-lockfile` in CI. Use a shared strict `tsconfig.base.json` and per-package `tsconfig.json` files with `composite`/project references (or an equivalent verified dependency-order build); typecheck **every** package, not just the Worker bundle. Do not bundle FokosDB's server classes into the browser client. Before standardizing, verify that Bun resolves the pinned FokosDB preview package, `cloudflare:workers` imports and Effect v4 prerelease without altering their workerd-targeted entry points. Use Wrangler's normal deploy path; Bun is not a replacement for the Workers runtime or Wrangler.

Do not relocate or delete the Rust crates, Makefile or historical examples in this RFD. They remain a compatibility oracle until the TypeScript acceptance tests pass. Any retirement of the Rust workspace is a later decision.

## Data model and read consistency

Use versioned, append-only records in FokosDB. Draft logical item types (physical key design is subject to a workerd spike):

- `head(dbId)`: last **committed** sequence number.
- `commit(dbId, txId)`: immutable commit metadata and optional idempotency record.
- `fact(dbId, factId)`: immutable typed fact with its commit ID, source and timestamp.
- `posting(dbId, accessPath, components..., txId, factId)`: immutable lookup entry pointing to a fact.

Required access paths for the currently planned scans: entity, entity+field, field, field+value, and value. An entity+value path may be needed for field-variable queries. Encode typed values and key components with an unambiguous, length-safe, order-preserving codec **where range order matters**; do not join raw strings with `/` or conflate a URI value with a string of the same spelling. Include fact ID so duplicate facts in one commit do not collide. Use FokosDB hash keys to select each access path and sort keys for commit/fact ordering, then paginate `queryItems` until the page cursor is exhausted or an explicit query budget is reached. Verify key-size, transaction-size, page-size and hot-partition constraints against the pinned FokosDB version before fixing the physical layout.

**Commit protocol, candidate:** read `head`, choose its successor, then issue a FokosDB `transactWriteItems` containing a condition on the old head, the new head, commit record, facts and *all* their postings. On a condition conflict retry the whole operation with the **same request identity** but a newly computed candidate. Return the commit ID only after the transaction succeeds. Bound batch size to FokosDB's supported transaction limits; reject or redesign larger batches, never silently split one PachaDB commit into partially visible transactions. FokosDB's client request token only retains completed outcomes for a limited window (currently documented as 10 minutes); long-lived API idempotency needs its own persisted request-key mapping if required. Confirm the exact condition-expression and same-item transaction constraints in an integration test before adopting this protocol. If the CAS approach fails, evaluate a **per-db** sequencer DO, but still commit head+facts+postings atomically in FokosDB.

`asOf` is an **inclusive committed transaction ID**. A query without `asOf` reads the committed head once at its start. A query with `asOf > head` fails validation; `asOf = 0` represents empty history. Scan postings with `txId <= asOf` and fetch their facts. Concurrent newer commits must be filtered out, including across later pages. No fact or posting is deleted in v1. Prove with tests that multi-page reads over a moving FokosDB table cannot skip or duplicate qualifying entries, or document/resolve any pagination limitation. This is a logical commit snapshot for append-only data, not a claim of FokosDB-wide historical snapshots. Avoid JS unsafe integers for persisted IDs: use validated decimal strings (or an explicitly bounded safe-integer range with overflow handling) at public and storage boundaries.

## Query execution

Port the grammar for a parenthesized sequence of `(entity field value)` terms, variables, quoted symbols and supported equality forms. Validate that the token count is divisible by three and reject unsupported nested forms, unsafe/range-unrestricted rules, and impossible unbound scans with a typed error. Make supported query semantics explicit: triple patterns, shared-variable joins, repeated-variable equality, result projection and deduplication. `source` and `stated_at` are stored metadata, not queryable triple positions until specified separately.

For each atom choose a selective index from the bound constants, use bounded paged scans, decode facts, and perform joins with a shared substitution map. Include a query budget (postings examined, rows emitted, elapsed time and pagination limit); return a distinct budget error rather than partial results presented as complete. Design a cursor API for results if necessary. Queries with no selective bound atom (or a variable field and no usable access path) are rejected initially, rather than quietly scanning every fact. Start with simple conjunctive queries; port recursive solver behavior only if an explicit compatibility test and resource budget justify it.

## TypeScript, Effect and Schema

Pin an exact Effect v4 prerelease and its documented Schema API; **do not assume `@effect/schema` is a separate v4 package**. As of this RFD, npm's `effect` dist-tags include a v4 RC while `latest` is v3. Confirm Workers/workerd compatibility and the actual imports with a compiled spike before establishing the package layout. Pin FokosDB to a specific build/commit rather than `@main`; the upstream README explicitly says not to use it in production yet.

Use `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `verbatimModuleSyntax` and `noEmit` in CI (plus platform-appropriate ES/Workers libs). No implicit `any`, unchecked `JSON.parse` casts, or assumed trusted FokosDB generic read types. Define Schema codecs for external requests/responses, `Fact`, `TxId`, values, and persisted record variants with storage schema versions. Map validation, conflict, unavailable, corrupt-storage and query-budget failures to explicit Effect error variants and HTTP status codes. Keep secrets in bindings and scope authorization to `dbId` before reading or writing.

## Rollout and verification

1. **Workspace and contract/feasibility spike:** add the Bun workspace root, lockfile and minimal package/app skeleton without moving Rust code; pin versions; deploy FokosDB's two DO classes locally in workerd; prove conditional head update, multi-item atomicity, keyed paginated scans and an `asOf` query during concurrent writes. Check Bun installation and script execution against the workerd test/deploy toolchain. Record API limits and measured costs. This is a go/no-go gate.
2. **Pure port:** port types, parser and basic join evaluator; turn representative Rust tests and README examples into shared fixtures. Explicitly record intentional deviations from undefined Rust behavior.
3. **Storage adapter:** implement versioned codecs, atomic commit, idempotency decision, indexes, head reads and paged scans. Test failures/retries and key collisions with property-based tests.
4. **Worker API:** implement `state` and `query` with Schemas, auth, budgets, generated binding types, observability and local workerd integration tests.
5. **Optional adapters:** Node/in-memory repository, browser-facing client, CLI; then benchmark and decide on retractions, consolidation and broader query support.

Acceptance tests must include: read-your-writes after a successful batch; no visible partial commit after failure; concurrent writers get unique ordered commits; retry does not duplicate facts; `asOf` includes its named commit and excludes later ones; page boundaries under concurrent appends; repeated-variable joins; empty and malformed queries; URI/string key collisions; and transaction/query limits. Run typecheck and runtime tests in CI against pinned dependencies.

## Feasibility spike results (2026-09-30)

A small Bun workspace and isolated Worker now live in `apps/worker`. The proof uses FokosDB preview commit `70e42ce` and Effect `4.0.0-rc.118`; its Worker imports `Schema` and `SchemaParser` from `effect` and re-exports FokosDB's DO classes. `bun run typecheck` passes with the strict Worker tsconfig. `bun run test:worker` starts Wrangler in **local workerd**, and verified:

- An initial conditional transaction writes a head and posting, both readable immediately.
- Two competing conditional head+posting transactions produce exactly one successful commit and one condition cancellation; only the winning posting is visible.
- A seven-row index partition can be scanned through four `queryItems` pages (`limit: 2`) with no missing or duplicate rows.

This is **not yet** a proof of multi-page scans during concurrent writes, failed/crashed participant recovery, idempotent retries, the full fact/posting transaction at maximum size, or end-to-end `asOf` behavior. The pinned library currently caps transactional writes at 100 items / 4 MiB total payload; at six postings plus one fact per stated fact, this implies a low maximum batch size before head/commit/idempotency entries. Benchmark and enforce the actual limit before implementing the public API.

The Worker is deployed as `pachadb-feasibility` on **`pachadb.leostera.dev`**, with `workers_dev: false`. Before deployment, a Cloudflare Access self-hosted application was created for the entire hostname and attached to an existing reusable allow policy restricted to the account operator's email. An unauthenticated POST to `/spike` receives Access's 302 login redirect, not the Worker response. After authenticating through Access as the policy's allowed user, both the **remote** atomicity and pagination tests returned HTTP 200 and `pass: true`, matching local workerd results. The deployed Worker has its `workers.dev` and preview routes disabled (confirmed through the Workers listing). This endpoint is a temporary, Access-protected diagnostic harness, not a public database API; remove or replace it after the spike.

Local toolchain note: on the testing machine the Homebrew `node` on `PATH` cannot load its `simdjson` dylib. Running Wrangler under Bun starts a listener but local requests hang; using the installed Node 24 works. For this machine, run `PATH=/opt/homebrew/opt/node@24/bin:$PATH bun run test:worker` (and likewise for `bun run dev`/`bun run deploy`). CI should install a supported Node version alongside Bun, because Wrangler's dev process is Node-based. No global Node installation was changed.

## Next gate: One Piece graph ingestion and multi-hop query load test

The current spike establishes only small transactional primitives. The next go/no-go test should reproduce the *shape* of the load tests in [`leostera/poneglyph`](https://github.com/leostera/poneglyph): its `tests/fixtures/download_onepiece_fandom.sh` obtains the One Piece **Fandom MediaWiki** XML export (`onepiece_pages_current.xml.7z`), and `crates/poneglyph-local/tests/stress.rs` parses pages, derives title/category/link facts, and runs semantic joins. This is a Fandom MediaWiki export, **not a Wikimedia-hosted dataset**. The archive was about 65 MB compressed when checked; cache it locally and record URL, retrieval time and SHA-256. Respect its CC BY-SA terms and attribution if republishing derived content. Do not commit the dump or import page text by default.

Build a deterministic, streaming **local Bun importer** with a versioned mapping: stable page IDs or collision-safe encoded titles become URI entities; titles/namespaces are text facts, internal links are URI-valued `wiki:page:link` facts, and category relationships are separate facts. Resolve redirects and normalize link targets to the same entity IDs used for pages; otherwise multi-hop joins will silently miss edges. Preserve `source` and page/revision identity, deduplicate repeated edges, record unresolved links, and compare fact/edge counts against an independently computed fixture manifest. Avoid the Poneglyph playground's slug encoding as-is (it can collide), and keep its explicitly hand-added crew/island/Joy Boy lore facts in a **separate synthetic fixture**: those joins do not prove that the underlying wiki actually contains those relationships.

Before bulk import, implement the v1 PachaDB fact/posting writer and bounded query evaluator from this RFD. The present `/spike` endpoint is **not** an importer or a query engine. Publish only a scoped, Access-protected batch-ingest endpoint (or a controlled job) with a deterministic per-batch idempotency key, checkpoint/resume support, bounded concurrency, retries/backoff and measurable progress. Cap batches below FokosDB's transaction limit (currently 100 items / 4 MiB **including all index postings and the head**); do not simply reuse Poneglyph's 10,000-fact batches. Keep upload data and local cache out of git, and budget Cloudflare writes/DO traffic before attempting the full dump.

Run increasing tiers: a tiny fixed fixture for correctness, then 500, 5,000, 50,000 and (only if costs and correctness allow) the full export. At each tier report page count, facts/postings, unresolved links, bytes, import wall time, commits/sec, retries/conflicts, Worker/DO errors, storage size and approximate Cloudflare usage. Use the *same normalized facts and query semantics* for side-by-side measurements against Poneglyph/Datafox; its published local 50,000-page / ~306,278-fact / ~44 ms-per-query example is a **reference workload**, not an expected Workers latency target.

Define fixtures and an independent expected-result oracle for (a) bounded one-hop page/category lookups, (b) real wiki link paths of two, three and four hops with bound start/end nodes, and (c) joins of link edges to title/category facts. Measure cold vs warm p50/p95/p99 latency, rows/postings scanned, pages read, fan-out, result counts, result-set hashes, and the number of requests hitting query budgets. Include an `asOf` run while ingest continues to test multi-page snapshot filtering. Query a synthetic lore fixture separately for the named captain/Joy Boy examples, labelled as synthetic. Do **not** report an empty result or a timeout as a successful multi-hop query. A 50,000-page run only passes if ingest completes/resumes without silent loss, independently expected results match, and selective multi-hop queries finish within documented budgets. Set performance/cost thresholds before collecting results rather than after seeing them.

A bounded real-data graph pilot and its limitations are tracked in [`docs/spikes/onepiece-graph.md`](spikes/onepiece-graph.md). Treat it as a **living regression workload**: keep correctness and query-budget checks running as the storage layer, query planner, and join engine are ported and optimized. Do not substitute the temporary page-adjacency API for the fact/transaction semantics proposed above.

## Risks and decisions needed

| Question | Default / decision gate |
| --- | --- |
| Is FokosDB acceptable for durable production data? | **No for now**: upstream cautions against production use and breaking changes. Prototype first; revisit when stable or choose a mature backend. |
| Does FokosDB permit the proposed conditional head+postings transaction at the needed sizes and throughput? | Prove in phase 1. If not, revise physical layout/commit protocol before porting more features. |
| What does `asOf` mean? | Inclusive committed transaction ID; not wall-clock `stated_at`. |
| Do we need arbitrary unbound graph queries? | Not in v1; either design a bounded global access path or explicitly reject them. |
| What are acceptable per-db write contention and per-query fan-out? | Measure; head CAS is a potential bottleneck, and Datalog joins can explode. |
| Are existing KV datasets to be migrated? | Separate migration RFD, including validation, cutover and rollback; no automatic compatibility claim. |
| How much of the current Datalog engine is contractual? | Only behavior backed by tests and explicitly adopted here; decide recursive rules and retractions separately. |

## References

- Local: `README.md`, `core/src/{model,tx_manager,index,query_planner,query_executor}.rs`, `core/src/nanolog/`, `backend-cloudflare/src/lib.rs`.
- FokosDB: <https://github.com/lambrospetrou/fokosdb/blob/main/packages/fokosdb/README.md> (deployment, package warnings); <https://github.com/lambrospetrou/fokosdb/blob/main/packages/fokosdb/src/client/index.ts> (public API).
- Cloudflare DOs: <https://developers.cloudflare.com/durable-objects/>; Workers testing: <https://developers.cloudflare.com/workers/testing/>.
