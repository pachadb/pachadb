# @pachadb/core — conjunctive fact-query engine

A portable port of the Rust engine's triple-pattern query subset. No Cloudflare imports.

```text
(wiki:page:1439 wiki:page:link ?middle
 ?middle wiki:page:link ?end
 ?end wiki:page:title ?title)
```

`parse` validates parenthesized triples; `evaluate` plans supported scans per binding, unifies shared/repeated variables (including predicates when supported by the source), and returns all distinct substitutions. Fully grounded success returns `[{}]`; no match returns `[]`. Cycles are allowed: this is a relational join, not simple-path search. Bare and quoted constants compare as strings, matching the Rust query executor's stringification; a future typed query language must make URI versus text semantics explicit.

`FactSource` separates the engine from storage. Adapters declare supported binding shapes and yield bounded/paginated fact tuples. `streamQuery` yields complete matching rows incrementally using pull-based async-generator joins; it does not drain a scan before joining its first tuple. It emits one final `done` event only on successful completion. `evaluate` collects this same stream for the sorted JSON API, and `queryFacts` wraps the collector in Effect with typed `QueryError` failures.

Completed scan caches share a 1 MiB serialized-byte budget; each in-progress scan can retain at most 32 KiB (at most 32 pattern levels). Distinct-result keys have a 4 MiB serialized-byte cap plus the row-count limit. These measure serialized content, not exact JavaScript heap usage. Adapter page buffering is additional. Budgets for scans, candidates, intermediates and elapsed time fail explicitly. The deadline is cooperative between awaited operations, includes time paused by the consumer, and does not abort in-flight FokosDB I/O.

`@pachadb/core/http` exposes `queryResponse`: pull-driven NDJSON with `row`, terminal `done`, or terminal `error` records. **HTTP 200 or an early row is not proof of complete results**: clients must see `done` and reject truncated streams. Stream ordering is execution order, not sorted. Cancellation closes active iterators and signals the adapter to stop before subsequent pages; FokosDB's current RPCs cannot be forcibly aborted. No producer queue/unbounded prefetch is used; parallel scan scheduling is not implemented yet.

Current exclusions: recursion/rules, nested equality forms, retractions, aggregates, arbitrary scans, and transaction/snapshot storage. `apps/worker/src/facts.ts` exposes the existing 500-page fixture as `wiki:page:link` and `wiki:page:title` facts, requiring bound entity+field. It is a compatibility view, not the final temporal fact repository. `/facts/query` explicitly rejects `asOf`.

Run `bun test packages/core`, `bun run typecheck`, and (after Access login) `bun run test:facts` or `STREAM=1 bun run test:facts` for independent full-result 2/3/4-hop verification against the deployed fixture. Raw corpus files remain in ignored `.fixtures/`.
