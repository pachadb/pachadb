import { FokosDB, FokosTransactionCancelledError } from "fokosdb/client";
import { Effect, Schema, SchemaParser } from "effect";
import { queryFacts } from "@pachadb/core";
import { queryResponse } from "@pachadb/core/http";
import { graphFacts } from "./facts";
import { backfill, Ready, readyKey, seal } from "./backfill";
const FactQuery = Schema.Struct({ query: Schema.String });
const ParallelQuery = Schema.Struct({ query: Schema.String, concurrency: Schema.Number });
export { PartitionDO, TransactionCoordinatorDO } from "fokosdb/server";

const Input = Schema.Struct({ run: Schema.Literals(["atomicity", "pagination"]) });
const Page = Schema.Struct({ id: Schema.String, title: Schema.String, links: Schema.Array(Schema.String) });
const Ingest = Schema.Struct({ pages: Schema.Array(Page) });
const Path = Schema.Struct({ start: Schema.String, end: Schema.String, hops: Schema.Number });
const graphKey = (id: string) => `pacha:onepiece:500:v1:page:${id}`;
const linksKey = (id: string) => `pacha:onepiece:500:v1:links:${id}`;
const validId = (id: string) => /^[1-9][0-9]{0,9}$/.test(id);
const table = { name: "pachadb-feasibility-v1", ns: "PARTITION_DO", nsTx: "TRANSACTION_COORDINATOR_DO", rootTreesN: 2, hashSplitN: 2 } as const;
const db = new FokosDB({ table });

async function atomicity() {
  const prefix = crypto.randomUUID();
  const head = `spike:${prefix}:head`;
  const posting = `spike:${prefix}:index`;
  console.log("atomicity writing initial transaction");
  await db.transactWriteItems({ items: [
    { operation: "put", hashKey: head, data: { n: 1 }, condition: { op: "not_exists", args: [{ ref: "data" }] } },
    { operation: "put", hashKey: posting, sortKey: "0001", data: { tx: 1 } },
  ] });
  const headRead = await db.getItem({ hashKey: head });
  const postRead = await db.getItem({ hashKey: posting, sortKey: "0001" });
  const attempt = (suffix: string) => db.transactWriteItems({ items: [
    { operation: "put", hashKey: head, data: { n: 2 }, condition: { op: "eq", args: [{ ref: "data", path: "$.n" }, { val: 1 }] } },
    { operation: "put", hashKey: posting, sortKey: suffix, data: { tx: 2 } },
  ] });
  const raced = await Promise.allSettled([attempt("0002a"), attempt("0002b")]);
  const posts = await db.queryItems({ queries: [{ hashKey: posting }] });
  return { initialAtomicRead: headRead.found && postRead.found, winners: raced.filter(r => r.status === "fulfilled").length,
    rejectedAsCondition: raced.filter(r => r.status === "rejected" && FokosTransactionCancelledError.is(r.reason)).length,
    postings: posts.items.map(item => item.sortKey), pass: headRead.found && postRead.found && raced.filter(r => r.status === "fulfilled").length === 1 && posts.items.length === 2 };
}

async function pagination() {
  const key = `spike:${crypto.randomUUID()}:index`;
  await db.transactWriteItems({ items: Array.from({ length: 7 }, (_, i) => ({ operation: "put" as const, hashKey: key, sortKey: `${i}`.padStart(4, "0"), data: { tx: i + 1 } })) });
  const seen: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await db.queryItems({ queries: [{ hashKey: key }], limit: 2, ...(cursor ? { cursor } : {}) });
    seen.push(...page.items.map(item => String(item.sortKey)));
    cursor = page.cursor;
    pages++;
    if (pages > 10) throw new Error("pagination did not terminate");
  } while (cursor);
  return { pages, seen, pass: seen.length === 7 && new Set(seen).size === 7 };
}

async function ingest(input: unknown) {
  const { pages } = SchemaParser.decodeUnknownSync(Ingest)(input);
  if (pages.length < 1 || pages.length > 10) throw new Error("expected 1..10 pages per request");
  let written = 0;
  let skipped = 0;
  for (const page of pages) {
    if (!validId(page.id) || page.title.length > 255 || page.links.length > 20 || page.links.some(id => !validId(id)) || new Set(page.links).size !== page.links.length) throw new Error("invalid graph page");
    const record = { title: page.title, links: [...page.links].sort() };
    const existing = await db.getItem({ hashKey: graphKey(page.id) });
    if (existing.found) {
      if (existing.item.kind !== "json" || JSON.stringify(existing.item.data) !== JSON.stringify(record)) throw new Error("conflicting existing page");
      skipped++;
      continue;
    }
    try {
      await db.transactWriteItems({ items: [
        { operation: "put", hashKey: graphKey(page.id), data: record, condition: { op: "not_exists", args: [{ ref: "data" }] } },
        ...page.links.map(target => ({ operation: "put" as const, hashKey: linksKey(page.id), sortKey: target, data: { to: target } })),
      ] });
      written++;
    } catch (error) {
      // A concurrent retry may have committed the same page. The client can re-send
      // the batch; the next request compares the stored record before skipping it.
      throw error;
    }
  }
  return { written, skipped };
}

async function verify(input: unknown) {
  const { pages } = SchemaParser.decodeUnknownSync(Ingest)(input);
  if (pages.length < 1 || pages.length > 10) throw new Error("expected 1..10 pages per request");
  let checked = 0;
  let links = 0;
  for (const p of pages) {
    if (!validId(p.id) || p.links.length > 20) throw new Error("invalid page");
    const meta = await db.getItem({ hashKey: graphKey(p.id) });
    const expected = { title: p.title, links: [...p.links].sort() };
    if (!meta.found || meta.item.kind !== "json" || JSON.stringify(meta.item.data) !== JSON.stringify(expected)) throw new Error("page metadata mismatch");
    const found: string[] = [];
    let cursor: string | undefined;
    do {
      const result = await db.queryItems({ queries: [{ hashKey: linksKey(p.id) }], limit: 10, ...(cursor ? { cursor } : {}) });
      found.push(...result.items.map(item => String(item.sortKey)));
      cursor = result.cursor;
      if (found.length > 20) throw new Error("too many stored links");
    } while (cursor);
    if (JSON.stringify(found.sort()) !== JSON.stringify(expected.links)) throw new Error("stored links mismatch");
    checked++;
    links += found.length;
  }
  return { checked, links };
}

async function pathQuery(input: unknown) {
  const { start, end, hops } = SchemaParser.decodeUnknownSync(Path)(input);
  if (!validId(start) || !validId(end) || !Number.isInteger(hops) || hops < 2 || hops > 4) throw new Error("invalid path query");
  let scanned = 0;
  let pagesRead = 0;
  const neighbors = async (id: string) => {
    const found: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await db.queryItems({ queries: [{ hashKey: linksKey(id) }], limit: 10, ...(cursor ? { cursor } : {}) });
      pagesRead++;
      scanned += page.scannedCount;
      if (pagesRead > 100 || scanned > 500) throw new Error("graph query budget exceeded");
      for (const item of page.items) if (typeof item.sortKey === "string") found.push(item.sortKey);
      cursor = page.cursor;
    } while (cursor);
    return found;
  };
  const walk = async (path: string[]): Promise<string[] | undefined> => {
    if (path.length === hops + 1) return path.at(-1) === end ? path : undefined;
    for (const next of await neighbors(path.at(-1)!)) {
      if (path.includes(next)) continue;
      const found = await walk([...path, next]);
      if (found) return found;
    }
  };
  const path = await walk([start]);
  return { path: path ?? null, scanned, pagesRead, found: path !== undefined };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || !["/spike", "/graph/ingest", "/graph/verify", "/graph/path", "/facts/query", "/facts/query/stream", "/facts/v2/ingest", "/facts/v2/verify", "/facts/v2/seal", "/facts/v2/stream"].includes(url.pathname)) return new Response("Not found", { status: 404 });
    const length = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(length) || length < 1 || length > 20_000) return new Response("Expected bounded Content-Length", { status: 413 });
    try {
      const body: unknown = await request.json();
      if (url.pathname === "/facts/v2/ingest") return Response.json(await backfill(db, body, false));
      if (url.pathname === "/facts/v2/verify") return Response.json(await backfill(db, body, true));
      if (url.pathname === "/facts/v2/seal") return Response.json(await seal(db));
      if (url.pathname === "/facts/v2/stream") {
        if (typeof body === "object" && body !== null && "asOf" in body) return Response.json({ error: "Temporal queries are not implemented" }, { status: 400 });
        const parsed = SchemaParser.decodeUnknownSync(ParallelQuery)(body);
        const ready = await db.getItem({ hashKey: readyKey });
        if (!ready.found || ready.item.kind !== "json") return Response.json({ error: "v2 backfill not sealed" }, { status: 409 });
        const metadata = SchemaParser.decodeUnknownSync(Ready)(ready.item.data);
        const degrees = new Map(metadata.degrees.map(d => [d.id, d]));
        return queryResponse(graphFacts(db, "v2", degrees), parsed.query, request.signal, undefined, parsed.concurrency);
      }
      if (url.pathname === "/facts/query" || url.pathname === "/facts/query/stream") {
        if (typeof body === "object" && body !== null && "asOf" in body) return Response.json({ error: "Temporal queries are not implemented" }, { status: 400 });
        const parsed = SchemaParser.decodeUnknownSync(FactQuery)(body);
        if (url.pathname === "/facts/query/stream") return queryResponse(graphFacts(db), parsed.query, request.signal);
        return Effect.runPromise(queryFacts(graphFacts(db), parsed.query).pipe(
          Effect.map(result => Response.json(result)),
          Effect.catch(error => Effect.succeed(Response.json({ error: error.message, code: error.code }, { status: error.code === "Storage" ? 502 : error.code === "Budget" ? 422 : 400 }))),
        ));
      }
      if (url.pathname === "/graph/ingest") return Response.json(await ingest(body));
      if (url.pathname === "/graph/verify") return Response.json(await verify(body));
      if (url.pathname === "/graph/path") return Response.json(await pathQuery(body));
      const input = SchemaParser.decodeUnknownSync(Input)(body);
      const result = input.run === "atomicity" ? await atomicity() : await pagination();
      return Response.json(result, { status: result.pass ? 200 : 500 });
    } catch (error) {
      console.error("spike failure", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unknown failure" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
