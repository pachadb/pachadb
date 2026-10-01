import { Schema, SchemaParser } from "effect";
import type { FokosDB } from "fokosdb/client";
const prefix = "pacha:onepiece:500:v2";
export const readyKey = `${prefix}:ready`;
export const Degree = Schema.Struct({ id: Schema.String, outgoing: Schema.Number, incoming: Schema.Number });
export const Ready = Schema.Struct({ pages: Schema.Number, degrees: Schema.Array(Degree) });
const Page = Schema.Struct({ id: Schema.String, title: Schema.String, links: Schema.Array(Schema.String), incoming: Schema.Array(Schema.String) });
const Input = Schema.Struct({ pages: Schema.Array(Page) });
const idValid = (id: string) => /^[1-9][0-9]{0,9}$/.test(id);

export async function backfill(db: FokosDB, body: unknown, verify: boolean) {
  const { pages } = SchemaParser.decodeUnknownSync(Input)(body);
  if (!pages.length || pages.length > 5) throw new Error("Expected 1..5 pages");
  const ready = await db.getItem({ hashKey: readyKey });
  for (const p of pages) {
    if (!idValid(p.id) || p.title.length > 255 || p.links.length > 20 || p.incoming.length > 500 || [...p.links, ...p.incoming].some(id => !idValid(id)) || new Set(p.links).size !== p.links.length) throw new Error("Invalid page");
    const record = { title: p.title, links: [...p.links].sort() };
    const key = `${prefix}:page:${p.id}`;
    const old = await db.getItem({ hashKey: key });
    if (old.found) {
      if (old.item.kind !== "json" || JSON.stringify(old.item.data) !== JSON.stringify(record)) throw new Error("Immutable page conflict");
    } else {
      if (verify || ready.found) throw new Error("Missing page; cannot change sealed graph");
      await db.transactWriteItems({ items: [
        { operation: "put", hashKey: key, data: record, condition: { op: "not_exists", args: [{ ref: "data" }] } },
        ...p.links.flatMap(to => [
          { operation: "put" as const, hashKey: `${prefix}:links:${p.id}`, sortKey: to, data: { to } },
          { operation: "put" as const, hashKey: `${prefix}:incoming:${to}`, sortKey: p.id, data: { from: p.id } },
        ]),
      ] });
    }
    if (verify) {
      for (const [direction, expected] of [["links", p.links], ["incoming", p.incoming]] as const) {
        let cursor: string | undefined;
        const ids: string[] = [];
        do {
          const res = await db.queryItems({ queries: [{ hashKey: `${prefix}:${direction}:${p.id}` }], limit: 50, ...(cursor ? { cursor } : {}) });
          ids.push(...res.items.map(item => String(item.sortKey)));
          if (ids.length > 500) throw new Error("Verification budget exceeded");
          cursor = res.cursor;
        } while (cursor);
        if (JSON.stringify(ids.sort()) !== JSON.stringify([...expected].sort())) throw new Error(`${direction} verification mismatch`);
      }
      await db.putItem({ hashKey: `${prefix}:verified`, sortKey: p.id, data: { id: p.id, outgoing: p.links.length, incoming: p.incoming.length } });
    }
  }
  return { acknowledged: pages.length };
}

export async function seal(db: FokosDB) {
  let cursor: string | undefined;
  let count = 0;
  const degrees: { id: string; outgoing: number; incoming: number }[] = [];
  do {
    const page = await db.queryItems({ queries: [{ hashKey: `${prefix}:verified` }], limit: 100, ...(cursor ? { cursor } : {}) });
    for (const item of page.items) {
      if (item.kind !== "json") throw new Error("Expected verified degree metadata; rerun verification");
      degrees.push(SchemaParser.decodeUnknownSync(Degree)(item.data));
    }
    count += page.items.length;
    if (count > 500) throw new Error("Unexpected verification count");
    cursor = page.cursor;
  } while (cursor);
  if (count !== 500) throw new Error("Require 500 verified pages before querying v2");
  await db.putItem({ hashKey: readyKey, data: { pages: count, degrees } });
  return { sealed: true, pages: count };
}
