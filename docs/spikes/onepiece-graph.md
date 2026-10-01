# Spike: One Piece MediaWiki graph on PachaDB/FokosDB

- **Status:** 500-page pilot passed; scale/semantics gates still open
- **Date:** 2026-09-30
- **Related:** `docs/rfd-typescript-workers-fokosdb.md`

## Hypothesis and decision

Can an Access-protected Worker using FokosDB ingest an actual MediaWiki export as immutable graph facts and evaluate selective 2–4-hop graph queries on that graph, with correct results, bounded read/write costs, and acceptable latency? A seven-item FokosDB pagination check does not answer this.

This experiment must distinguish **real links extracted from the wiki** from Poneglyph's hand-authored crew/Joy Boy lore. It tests conjunctive joins on pages and links, not the full PachaDB grammar, recursive Datalog, retractions, global scans, or production readiness.

## Fixture and provenance

Source: One Piece Fandom MediaWiki export, as used in `leostera/poneglyph/tests/fixtures/download_onepiece_fandom.sh`, from `https://s3.amazonaws.com/wikia_xml_dumps/o/on/onepiece_pages_current.xml.7z`. Download to ignored `.fixtures/onepiece/`, never commit XML or archive. Archive retrieved 2026-09-30, 64,758,346 bytes; SHA-256 `c4e33cc6793425d9baa5f76a9f12f047d75dec135006093ed9357629a7d1f7bb`; XML is 436,781,838 bytes. Source advertises CC-BY-SA in `https://onepiece.fandom.com/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json`. Record attribution and source URL in run outputs; no page text in HTTP responses.

Select article namespace (`ns=0`) pages deterministically. Parse XML as a **stream**; no `readFile` of the whole dump. Normalize titles (underscores, fragment removal, first-letter/title capitalization per MediaWiki site rules), use collision-free URL escaping or stable MediaWiki page IDs and a title→ID map, and record redirects and unresolved targets. Reject rather than mislink ambiguous titles. Exclude external, interwiki, and category links from graph edges. Initial facts per page: `title` (string), `link` (URI to another selected page), optional `category` (separate). `source` identifies the dump and provenance. Only ingest edges where both endpoints resolve inside the selected corpus; report dropped edges. No injected lore facts in the real graph.

## Execution stages and stop gates

1. **Local fixture and oracle:** streaming parse, print checksum/counts, verify stable IDs and link resolution, derive graph and deterministic ground-truth results with an independent in-memory join/BFS. Pick real 2/3/4-hop *bounded* queries with non-empty results before contacting Cloudflare. Unit test title normalization and redirects. Stop if graph is disconnected or mapping is ambiguous.
2. **Writer and query slice:** implement a private Access-protected ingestion endpoint with typed, bounded batches, idempotency keys and persistent records/postings. Implement a selective `linksFrom`/`linksTo` scan and fixed-depth path query over FokosDB with pagination and explicit fan-out/query budgets. This is a first PachaDB domain slice, not arbitrary query syntax. Prove atomic visibility and an `asOf` boundary before claiming immutable graph semantics. Stop if FokosDB forbids the required transaction shape or queries silently truncate.
3. **Pilot:** import 100 then 500 pages into a new versioned DB/table. Set a strict ceiling on request count and items written; track exact acked/failed batches and idempotent resume. Compare read-back fact counts and the chosen paths to the local oracle. No fire-and-forget writes.
4. **Scale gates:** 5,000 and then 50,000 pages only if the pilot is correct and projected costs/latencies are acceptable; require explicit cost review before attempting the entire export. Do not attempt 10k-fact transactions: pinned FokosDB limits writes to 100 items / 4 MiB including indexes, head, and commit metadata.
5. **Report:** dataset counts, unresolved links, item/write count, elapsed wall time, batches/sec, error/retry count, storage/read/write cost estimate, per-query p50/p95/p99 cold/warm latency, visited nodes, scanned postings, query pages and result hashes. Repeat remote authenticated and local workerd runs; never compare local Poneglyph's published ~44 ms/query to a network request as though the runtimes were equivalent.

Abort on any missing/duplicate fact, mismatch with oracle, unexpected partial visibility, authentication gap, unbounded fan-out, sustained error/retry storm, or unexpectedly high projected charges. Keep `workers_dev` and previews disabled; verify Access login redirect for unauthenticated POST before each deployment. The diagnostic Worker must never return raw copyrighted wiki text or expose an unauthenticated import route.

## Results: first bounded graph pilot

The archive was downloaded and checksummed locally. `packages/onepiece-fixture/src/oracle.ts` stream-parsed the first 500 main-namespace pages into a cached manifest; 145 were redirects. The parser observed 41,078 raw link occurrences, but only links resolved to selected pages are eligible for this pilot. To cap per-page transactions, the pilot **keeps at most 20 distinct outgoing links per page**; this is a deliberate lossy sample, **not a full wiki import**. The resulting graph has 5,425 stored edges. The local oracle found real (not hand-authored lore) 2-, 3-, and 4-hop paths. The importer/Worker share this reduced manifest, so the current oracle does not independently validate the entire XML link extraction; improve that before a larger run.

The Access-protected `pachadb-feasibility` Worker at `pachadb.leostera.dev` imported 50 pages, then resumed to 500 without conflicts. The second run acknowledged 450 newly written pages and 50 skipped; the full run took ~34 seconds including requests over the network. A third run skipped all 500 and independently **read back all 500 page records and all 5,425 link postings** through FokosDB, matching the local reduced manifest. No raw wiki text was sent. Unauthenticated POSTs to the graph endpoint returned Access HTTP 302; Wrangler's `workers_dev` and previews are disabled. This pilot uses one conditional FokosDB transaction per page, with metadata + up to 20 keyed link postings.

Three remote path queries returned real, verified routes (not necessarily the oracle's *first* route):

| Depth | Example endpoint (page IDs) | HTTP wall time, single run | Postings scanned / query pages |
| --- | --- | ---: | ---: |
| 2 | 1439 → 1847 | 170 ms | 135 / 14 |
| 3 | 1439 → 1524 | 197 ms | 157 / 16 |
| 4 | 1439 → 1914 | 556 ms | 448 / 48 |

These timings are **single samples**, not p50/p95/p99; the 4-hop DFS already nears the current 500-posting query budget. They exclude fixture download/parser time, and no Cloudflare billing estimate was measured. The pilot proves keyed graph traversal and readback at this small scale, **not** a PachaDB-compatible fact store: it has no commit head, no transaction IDs, no `asOf`, no general triple-pattern parser/query executor, no full link ingestion, and only outgoing link postings. The test endpoints are diagnostics, not a production API.

## Fact-query engine port: complete result verification

`packages/core` now implements the portable conjunctive triple-pattern parser, binding-aware scan planner, unification, complete set-valued projection, and explicit budgets, wrapped in Effect. `apps/worker/src/facts.ts` maps the stored page/link fixture to fact scans; `POST /facts/query` accepts `{ "query": "(...)" }`. Unlike the previous DFS endpoint, queries enumerate **all matching bindings**, including cyclic paths allowed by relational joins. This is a real query-engine slice, but still not a temporal fact store; `asOf` is rejected.

`bun run test:facts` computes all expected paths independently from the cached fixture (without importing the evaluator) and compares complete sorted result sets. Local workerd and authenticated remote runs matched identical SHA-256 result hashes:

| Hops | Rows | Remote single-sample time | Scans / candidates / join intermediates | Result hash |
| --- | ---: | ---: | --- | --- |
| 2 | 3 | 620 ms | 21 / 23 / 23 | `f65a3ef30d32c55b35434fbd44aeb23eaef2788339dac64287fbe3fda0ef67ad` |
| 3 | 147 | 2,220 ms | 165 / 460 / 549 | `cee61c8ab79e9dcd14295b37dbf21ce5d6476b7948cd0dd746a8084a1288f14c` |
| 4 | 712 | 6,825 ms | 436 / 2,653 / 8,243 | `7ae7046538e4a6e40eb187e5de641ba0ff53535dc6f7e1339248ce8d47c40e30` |

These are not comparable to first-path timings above. The sequential indexed nested-loop implementation is correct on this fixture but clearly needs fewer remote round trips. Six unit tests cover join reordering, repeated-variable equality, constant queries, predicate binding, malformed/unsupported syntax and budget failures. Strict typechecking passes for core, Worker, fixture tooling and scripts. Deployment `b836bf72-fea6-45f3-9738-907538953cf0` remains protected by Access (unauthenticated `/facts/query` POST returns 302).

A source-level [Poneglyph/Datafox comparison](query-engine-comparison.md) now records the actual upstream contracts, execution paths, gaps and adoption order.

### Incremental query streaming

`POST /facts/query/stream` now returns NDJSON matching rows as the joins produce them. The core is a pull-based async generator; the HTTP stream uses one generator step per pull with no prefetch queue. Scans are joined incrementally rather than drained first. Completed-scan caching and distinct-state storage are byte-budgeted. On failure after rows, the protocol emits `error`, not `done`; clients must require the terminal `done` to accept complete results. Cancellation propagates through iterators and prevents further adapter page requests, although already-running FokosDB RPCs cannot be forcibly cancelled. This remains sequential streaming, not a parallel scheduler.

Both the original collected endpoint and streaming endpoint pass local workerd complete-result checks. Authenticated remote `STREAM=1 bun run test:facts` yielded identical full-result hashes, with these **single-run** timings:

| Hops | Rows | First row | Completion |
| --- | ---: | ---: | ---: |
| 2 | 3 | 491 ms | 683 ms |
| 3 | 147 | 144 ms | 2,313 ms |
| 4 | 712 | 73 ms | 7,120 ms |

The runs occurred in sequence and are not controlled cold/warm comparisons. Streaming improves time to useful output, not total work. The 4-hop case now performs 437 scans rather than 436: a recursive reuse can occur before the outer scan completes and becomes cacheable. Eleven tests now cover early joined output, consumer backpressure, duplicate suppression, cancellation, and terminal errors after partial delivery, alongside prior query semantics. Remote version: `8c7d2a38-de08-4e13-9bf8-eabc913c5d37`. Access still redirects unauthenticated streaming POSTs (302).

Next engine steps: batching/selective reverse indexes and a cost-aware join planner; negative/full-result title-join cases; persisted snapshot/commit semantics; then larger datasets. Do not mistake this read-only compatibility adapter for completion of the storage port.

**Next iteration:** make the reduced graph and performance report a reproducible checked-in *manifest of counts and result hashes* (not wiki content); run an independent extraction oracle; implement typed fact/posting records and committed snapshots, reciprocal/selective indexes, a planned join instead of exhaustive DFS, retries that distinguish conflicts from transient errors, then test 5k pages against predeclared cost and latency thresholds. Keep this pilot as a regression baseline while porting/optimizing PachaDB; increase scale only when the last tier remains correct and bounded.
