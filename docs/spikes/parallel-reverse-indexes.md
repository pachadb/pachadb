# Spike: reverse indexes and bounded parallel reads

Status: implementing / validating. Target: existing Access-protected `pachadb.leostera.dev` diagnostic Worker.

## Hypotheses

1. Incoming-edge scans let bound destination nodes drive a join, reducing total remote probes for endpoint-bound queries.
2. A small concurrency window overlaps independent storage reads without unbounded buffering or changing complete result sets.

Neither improvement is assumed. Compare v1 serial, v2 serial, and v2 concurrency=4 using the same 500-page/5,425-edge fixture and independent complete-result hashes. Report first row, completion, logical scans, remote reads, physical rows read and peak active reads. Single samples are diagnostic, not latency percentiles or billing predictions.

## Index/migration plan

Keep v1 intact. Use a new `pacha:onepiece:500:v2` keyspace: immutable page metadata, outgoing `(source,target)` postings, incoming `(target,source)` postings. Each page's metadata and both index directions are one conditional transaction: at most 41 items with the pilot's 20-link cap (below FokosDB's 100-item cap). This is still the frozen fixture, not a temporal fact repository.

The operator-controlled script runs **sequential import → full outgoing/incoming verification → seal**. Identical pages can be retried; conflicting pages fail. Each verified page gets a marker; 500 distinct verified pages are required to seal. V2 queries reject an unsealed graph. Existing endpoints continue using v1; no automatic switch. After seal, new page IDs are rejected. Do not run concurrent migration operators: the diagnostic seal is not a general-purpose transactional migration coordinator, and input provenance still comes from the local pinned fixture/oracle.

## Execution plan

- The adapter supports bound-entity outgoing, bound-value incoming, and exact link probes.
- Prefer fully bound patterns, then use an **experimental incoming-first tie-breaker**. This is not an actual cardinality estimate; measure whether it helps before making a general planner decision.
- Only split the first join into fixed waves of at most 4 branches (API allows 1..8); deeper joins remain serial within each branch. No recursive fan-out explosion.
- Each branch buffers at most one next output; the parent scan is paused during the wave. Slow consumers stop scheduling further branch steps, with at most the current wave's in-flight work remaining.
- Distinct keys, budgets and completed-scan cache are shared per query. Independent branches may duplicate an in-flight scan before it is cacheable. Do not share incomplete cached results.
- Cancellation closes all active branch generators; in-flight FokosDB calls finish but no new page requests follow an observed abort. A failure emits terminal error, never done.

## Acceptance

Require serial/parallel and forward/reverse full-result hash equality at 2/3/4 hops; verify every outgoing and incoming posting; prove max concurrency in unit tests; test cancellation and branch errors; check unauthenticated streaming POST redirects to Access. Run local workerd first, then the remote backfill. Stop on any correctness/authentication gap; retain v1 as rollback/reference. Do not scale the dataset in this spike.

Commands (Node 24 must be working for Wrangler):

```sh
bun run typecheck
bun test packages/core
# Set ONEPIECE_URL=http://127.0.0.1:<port> for local workerd runs.
bun scripts/onepiece-backfill-v2.ts
STREAM=1 bun run test:facts
INDEX_VERSION=v2 CONCURRENCY=1 bun run test:facts
INDEX_VERSION=v2 CONCURRENCY=4 bun run test:facts
```
