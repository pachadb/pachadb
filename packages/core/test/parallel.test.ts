import { expect, test } from "bun:test";
import { streamQuery, type FactSource, type Row } from "../src/index";

function fixture() {
  let active = 0, peak = 0, closed = 0;
  const source: FactSource = {
    supports: ([e, f]) => e !== undefined && f !== undefined,
    async *scan([entity, field]) {
      if (field === "edge") { for (const id of ["b", "c", "d", "e", "f"]) yield ["a", "edge", id]; return; }
      peak = Math.max(peak, ++active);
      try { await Bun.sleep(5); yield [entity!, "name", entity!]; } finally { active--; closed++; }
    },
  };
  return { source, stats: () => ({ active, peak, closed }) };
}
async function collect(source: FactSource, concurrency: number) {
  const rows: Row[] = [];
  for await (const e of streamQuery(source, '(a edge ?x ?x name ?name)', undefined, undefined, concurrency)) if (e.type === "row") rows.push(e.row);
  return rows.map(r => JSON.stringify(r)).sort();
}
test("parallel branches match serial results and respect the fixed bound", async () => {
  const serial = fixture(), parallel = fixture();
  expect(await collect(parallel.source, 3)).toEqual(await collect(serial.source, 1));
  expect(parallel.stats()).toEqual({ active: 0, peak: 3, closed: 5 });
  expect(serial.stats().peak).toBe(1);
});
test("cost hints choose a selective reverse scan without changing answers", async () => {
  const calls: string[] = [];
  const facts = [["a", "edge", "b"], ["b", "edge", "c"]] as const;
  const source: FactSource = {
    supports: ([e, , v]) => e !== undefined || v !== undefined,
    cost: ([e]) => e === undefined ? 1 : 20,
    async *scan(p) { calls.push(JSON.stringify(p)); for (const f of facts) if (p.every((v, i) => v === undefined || v === f[i])) yield f; },
  };
  const rows: Row[] = [];
  for await (const e of streamQuery(source, '(a edge ?x ?x edge c)', undefined, undefined, 4)) if (e.type === "row") rows.push(e.row);
  expect(calls[0]).toBe('[null,"edge","c"]');
  expect(rows).toEqual([{ "?x": "b" }]);
});

test("cancelling a parallel wave closes all active branches", async () => {
  const f = fixture();
  const it = streamQuery(f.source, '(a edge ?x ?x name ?name)', undefined, undefined, 3);
  await it.next();
  await it.return();
  expect(f.stats()).toEqual({ active: 0, peak: 3, closed: 3 });
});
test("parallel branch error terminates without done and closes peers", async () => {
  let closed = 0;
  const source: FactSource = { supports: ([e]) => e !== undefined, async *scan([e, f]) {
    if (f === "edge") { yield ["a", "edge", "b"]; yield ["a", "edge", "c"]; return; }
    try { await Bun.sleep(1); if (e === "b") throw new Error("failed branch"); yield [e!, "name", "C"]; }
    finally { closed++; }
  } };
  const events: string[] = [];
  await expect((async () => { for await (const e of streamQuery(source, '(a edge ?x ?x name ?name)', undefined, undefined, 2)) events.push(e.type); })()).rejects.toThrow("failed branch");
  expect(events).not.toContain("done");
  expect(closed).toBe(2);
});
