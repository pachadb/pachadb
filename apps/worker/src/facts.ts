import { type FactSource, QueryError } from "@pachadb/core";
import { Schema, SchemaParser } from "effect";
import type { FokosDB } from "fokosdb/client";
const StoredPage = Schema.Struct({ title: Schema.String, links: Schema.Array(Schema.String) });
const Posting = Schema.Struct({ to: Schema.String });
const ReversePosting = Schema.Struct({ from: Schema.String });
const valid = (v: string | undefined) => v !== undefined && /^wiki:page:[1-9][0-9]{0,9}$/.test(v);

/** Compatibility view; v2 is usable only after a verified backfill is sealed. */
export function graphFacts(db: FokosDB, version: "v1" | "v2" = "v1", degrees: ReadonlyMap<string, { outgoing: number; incoming: number }> = new Map()): FactSource {
  let remoteReads = 0, active = 0, peakReads = 0, rowsRead = 0;
  const io = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (++remoteReads > 2000) throw new QueryError("Budget", "Storage read budget exceeded");
    peakReads = Math.max(peakReads, ++active);
    try { return await fn(); } finally { active--; }
  };
  const prefix = `pacha:onepiece:500:${version}`;
  return {
    supports: ([entity, field, value]) =>
      (valid(entity) && (field === "wiki:page:link" || field === "wiki:page:title")) ||
      (version === "v2" && entity === undefined && field === "wiki:page:link" && valid(value)),
    // Exact frozen-fixture degree counts; fully bound probes remain preferred by the engine.
    cost: ([entity, field, value]) => {
      if (field === "wiki:page:title" || (entity !== undefined && value !== undefined)) return 1;
      if (entity !== undefined) return degrees.get(entity.slice(10))?.outgoing ?? 20;
      return value === undefined ? 500 : degrees.get(value.slice(10))?.incoming ?? 500;
    },
    metrics: () => ({ remoteReads, peakReads, rowsRead }),
    async *scan([entity, field, value], signal) {
      const check = () => { if (signal?.aborted) throw new QueryError("Cancelled", "Query cancelled"); };
      check();
      if (!field) throw new QueryError("Unsupported", "Expected bound field");
      if (field === "wiki:page:title" && entity) {
        const result = await io(() => db.getItem({ hashKey: `${prefix}:page:${entity.slice(10)}` }));
        check();
        rowsRead += result.meta.rowsRead;
        if (!result.found) return;
        if (result.item.kind !== "json") throw new QueryError("Storage", "Invalid page encoding");
        const record = SchemaParser.decodeUnknownSync(StoredPage)(result.item.data);
        if (value === undefined || record.title === value) yield [entity, field, record.title];
        return;
      }
      const reverse = entity === undefined;
      if (reverse && (version !== "v2" || !valid(value))) throw new QueryError("Unsupported", "No reverse index");
      if (!reverse && value !== undefined && !valid(value)) return;
      const anchor = reverse ? value : entity;
      if (!anchor) throw new QueryError("Unsupported", "Unbound scan");
      let cursor: string | undefined;
      do {
        check();
        const result = await io(() => db.queryItems({ queries: [{ hashKey: `${prefix}:${reverse ? "incoming" : "links"}:${anchor.slice(10)}`, ...(!reverse && value !== undefined ? { sortKeyCondition: { op: "eq" as const, value: value.slice(10) } } : {}) }], limit: 10, ...(cursor ? { cursor } : {}) }));
        rowsRead += result.meta.rowsRead;
        check();
        for (const item of result.items) {
          check();
          if (item.kind !== "json") throw new QueryError("Storage", "Invalid link encoding");
          const id = reverse ? SchemaParser.decodeUnknownSync(ReversePosting)(item.data).from : SchemaParser.decodeUnknownSync(Posting)(item.data).to;
          if (id !== item.sortKey) throw new QueryError("Storage", "Link key/value mismatch");
          yield reverse ? [`wiki:page:${id}`, field, anchor] : [anchor, field, `wiki:page:${id}`];
        }
        cursor = result.cursor;
      } while (cursor);
    },
  };
}
