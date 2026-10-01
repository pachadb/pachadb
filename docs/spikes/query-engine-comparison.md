# Comparison: PachaDB spike vs Poneglyph and Datafox

Date: 2026-09-30. Source review, **not** a fresh comparative benchmark. No engine changes or deployments made for this review.

## Sources reviewed

Upstream `main` revisions observed during review:

- Datafox: [`8bc96987029f79391e16476ef08d45b90ac31e47`](https://github.com/leostera/datafox/tree/8bc96987029f79391e16476ef08d45b90ac31e47), especially `src/{client,plan,storage,evaluator}.rs`.
- Poneglyph: [`a9c678ac96c64ad30060ed41b563c6ec4d374919`](https://github.com/leostera/poneglyph/tree/a9c678ac96c64ad30060ed41b563c6ec4d374919), especially `crates/poneglyph/src/{query,active_graph}.rs` and `crates/poneglyph-local/src/facts/lsm/{key,mod}.rs`.
- Local spike: `packages/core/src/index.ts`, `apps/worker/src/facts.ts`, and `scripts/fact-query-check.ts`.

The upstream files were fetched from main, rather than relying on the local Poneglyph checkout, which lacks the newer fixture files.

## Main finding

Our port is a small **positive conjunctive query evaluator**, not parity with either newer implementation. Its strongest evidence is complete-result agreement with an independent traversal of the reduced graph. Its principal architectural weakness is its **outgoing-only storage interface plus sequential remote probes**, not the absence of a faster string parser.

The 4-hop run's 436 logical scans / 6.8 seconds is a useful symptom. It does not prove a specific optimization's speedup, and logical scans are not identical to FokosDB page requests or billed rows.

## Comparison matrix

| Area | Newer implementations, as observed | Current PachaDB | Recommendation |
| --- | --- | --- | --- |
| Storage requests | Datafox `FactRequest` carries predicate, typed pattern, projection, tuples/exists mode, snapshot selector and role/equality/limit hints (`storage.rs:17–130`). | Three optional strings and `supports`; no metadata, snapshot or projection. | Introduce an explicit request contract and adapter conformance tests before adding language features. Only advertise capabilities actually implemented. |
| Index coverage | Poneglyph maps patterns to field, field+entity, field+value, and fully bound filters (`query.rs:170+`); LSM has corresponding field/entity/value keyspaces (`key.rs`, `mod.rs:289+`). | Entity+field only; target-bound queries cannot drive a reverse scan. | Add field+value (incoming edges/title lookup) first, with atomic forward/reverse writes and a versioned backfill/cutover. Retain exact tuple lookup. |
| Plan representation | Datafox has validated, versioned prepared queries with interned variable/predicate/value IDs and required operators/relations (`plan.rs`). | Reparse strings and allocate/sort choices on every recursive visit. | Separate parse/prepare/execute; integer variable slots and reusable plans, followed by an explain/debug view. Keep runtime binding-aware choices where useful. |
| Ordering | Datafox respects required bindings, prefers connected clauses, then bound-variable count, estimated rows and original order (`plan.rs:307–459`). | Most bound terms among supported scans; constants and variables are counted alike. | Preserve safety/connectedness, then compare adapter costs/cardinalities. Include remote round-trip and page costs, not just tuple count. |
| Actual async planning path | Datafox `eval_streaming` calls `prepare`, while the synchronous `planner()` uses `FactStore` estimates. Poneglyph invokes the async `Storage` path (`client.rs:283+`, Poneglyph `query.rs`). | Dynamic binding count only. | Do not claim Poneglyph's async path already uses storage-estimated plans. Design an explicit async/cached estimation mechanism if needed; do not fetch statistics per seed. |
| Binding execution | Datafox prepared execution uses `PlanSeed` variable slots; repeated-variable equality is sent as a hint and checked during matching (`evaluator.rs:670–793`). | Clone string-keyed records; enforce repeated-variable equality locally. | Adopt slots and equality hints. Keep evaluator checks even when an adapter pushes constraints down. |
| Streaming | Datafox storage exposes a bounded tuple channel; `eval_plan_streaming` nevertheless collects matches and `next_seeds`, then final substitutions (`evaluator.rs:607–714`). Poneglyph LSM active scans also build vectors before channel delivery. | Adapter async iterators are drained into cached arrays; final results collected and sorted. | Neither is end-to-end bounded streaming. Implement byte-bounded caches, backpressure and cancellation intentionally; preserve an explicit complete-result API with hard failure on limits. |
| Parallelism | Datafox's synchronous plan evaluator has a Rayon path. Its reviewed async planned loop awaits each seed serially; Poneglyph selecting `.parallel()` does not make that loop concurrent. | Serial scans. | Deduplicate/batch remote requests and introduce bounded I/O concurrency. Do not port CPU thread pools into a Worker or use unbounded `Promise.all`. |
| Existence checks | Datafox distinguishes `Exists` (notably for negation) from tuples; Poneglyph can stop after its first matching tuple. | Fully grounded scans return tuples then unify/deduplicate. | Add a true exists capability once constraints are pushed down safely. Never limit to the first raw candidate before testing equality and residual predicates. |
| Caching | Poneglyph LSM caches decoded active facts, maintains cache on writes/retractions, and exposes hit/miss/row counters (`mod.rs:289–365`). | Per-query exact-pattern arrays; bounded indirectly by candidates, not bytes. | Keep query-scoped caching initially. Add explicit bytes/hit/miss counters; include snapshot and namespace in keys before cross-request reuse. |
| Semantics | Poneglyph queries active assertions, supports retractions and list expansion; its Datafox adapter maps rich values to integers/strings, including a predicate-dependent URI heuristic (`query.rs:194+`). | String triples over frozen page metadata/link postings; no fact history or active-state derivation. | Explicitly specify typed values, assertion identity, retractions and snapshots. Learn from the separation, not the lossy URI/text heuristic. |
| Result multiplicity | Reviewed Datafox planned paths append substitutions without a final distinct step. Poneglyph wraps/collects these substitutions. | Always distinct, deterministic row ordering. | Treat this as a semantic difference. Compare normalized sets for current regression tests, but decide bag/set behavior explicitly before claiming compatibility. |
| Language | Datafox includes safe negation, comparisons, arithmetic/call terms, string predicates and wildcards; tests verify required bindings. | Positive triples and quoted constants; nested equality/negation/builtins unsupported. | Port incrementally with differential tests. Do not infer recursive rule support merely from the word Datalog. |
| Testing | Datafox has source-order-vs-planned checks, serial-vs-parallel comparisons, parser/evaluator fuzz targets and property tests. Poneglyph tests retractions, membership and storage behavior. | Six unit tests plus three positive full-result fixture queries. | Add generated differential tests, zero-result and title/filter cases, cancellation/error/pagination tests, and storage capability matrices before raising scale. |

## What not to copy unquestioningly

1. **“Streaming” is not a memory guarantee.** Both reviewed paths retain materialized collections. Worker memory budgets need byte accounting, not only tuple limits.
2. **A `.parallel()` setting is not proof of concurrent async storage calls.** Review the actual call path; the async evaluator here uses sequential awaits.
3. **The snapshot contract is not time travel.** Datafox's reviewed `SnapshotSelector` contains only `Active`. PachaDB still needs its own commit watermark and immutable historical semantics.
4. **Hints are not necessarily enforced.** In the Poneglyph adapter, limit handling stops for `Some(1)` but does not generally count arbitrary limits; projection/equality hints are not all pushed down there. Define enforceable semantics, including whether a limit means truncation or a budget error.
5. **Rich fact types do not imply lossless query types.** Poneglyph's adapter intentionally stringifies several variants; copying that would preserve ambiguities we may want to remove.
6. **The One Piece extractor is not the query oracle.** Our independent join traversal checks execution on the same reduced input; it does not establish that XML extraction, redirect resolution, or truncation represents the complete wiki correctly.

## Proposed implementation order

### 1. Contract and correctness first

Define request, capabilities, prepared plan and typed value semantics. Maintain the existing public triple syntax as a compatibility frontend. Add generated tiny-graph differential tests against a simple source-order evaluator (including duplicate inputs, repeated variables, cycles, grounded predicates, empty results, and variable predicates). Pin the three complete-result hashes in the One Piece regression harness.

### 2. Indexes before CPU micro-optimization

Create a new fixture schema/version with outgoing and incoming postings plus title lookup, written atomically with page/fact metadata. Backfill and verify both directions before routing queries to it; never read partially built reverse indexes. The fixed pilot still fits at most 41 metadata+edge items per page at its 20-link cap, but the general fact design must account for all other indexes/head/idempotency writes against the 100-item cap.

Expose selective field+value scans. Add per-access-path estimates and explain output. Benchmark choosing the bound endpoint with lower degree and joining intermediate bindings. Do not claim a bidirectional planner exists in Datafox's reviewed implementation; it is our Workers-specific next optimization enabled by Poneglyph-style indexes.

### 3. Remote execution strategy

Group identical bound requests across seeds, batch FokosDB lookups where supported, and cap in-flight calls. Record remote pages, physical rows read, unique requests, cache hits, intermediate cardinalities and result bytes. Keep the complete result hashes unchanged; only then compare wall-time distributions, not just single runs.

### 4. Actual fact repository

Replace the page-adjacency compatibility view with versioned facts and atomic commit/index updates. Implement committed snapshots and retry identity before importing live mutations or claiming `asOf`. Poneglyph's log/active-graph split is the architectural reference, while FokosDB's transaction limits determine implementation constraints.

### 5. Scale and language

Rerun 500-page tests, then 5k under stated cost/memory/latency gates. Add safe comparisons, exists/negation and richer values only once their binding requirements and storage semantics are covered. Retain the graph workload as a permanent regression, not a one-off proof.

## Decision

Adopt **Poneglyph's index/active-graph separation** and **Datafox's prepared-plan/request/binding contracts**. Keep PachaDB's explicit budget failures and independent full-result oracle. Do not claim upstream parity or expect local Rust timings from a remote DO backend. The next code change should be request/capability tests followed by versioned reverse indexes, not simply increasing our query budget to hide the round trips.
