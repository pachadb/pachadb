import { expect, test } from "bun:test";
import { streamQuery, type FactSource } from "../src/index";
import { queryResponse } from "../src/http";

test("first joined row precedes remaining source facts; stopping closes scan", async () => {
  let pulled = 0, closed = 0;
  const source: FactSource = {
    supports: () => true,
    async *scan([entity, field]) {
      try {
        if (field === "title") { yield [entity!, "title", "First"]; return; }
        pulled++; yield ["a", "link", "b"];
        pulled++; yield ["a", "link", "c"];
      } finally { closed++; }
    },
  };
  const it = streamQuery(source, '(a link ?x ?x title ?name)');
  expect(await it.next()).toMatchObject({ value: { type: "row", row: { "?x": "b", "?name": "First" } } });
  expect(pulled).toBe(1);
  await it.return();
  expect(pulled).toBe(1);
  expect(closed).toBe(2);
});

test("NDJSON is pull driven, distinct, and terminates with done", async () => {
  let reads = 0;
  const source: FactSource = { supports: () => true, async *scan() {
    reads++; yield ["a", "link", "b"];
    reads++; yield ["a", "link", "b"];
    reads++; yield ["a", "link", "c"];
  } };
  const response = queryResponse(source, '(a link ?x)', new AbortController().signal);
  expect(reads).toBe(0);
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('"?x":"b"');
  expect(reads).toBe(1);
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('"?x":"c"');
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('"type":"done","rows":2');
  expect((await reader.read()).done).toBe(true);
});

test("late failure yields terminal error, never done", async () => {
  const source: FactSource = { supports: () => true, async *scan() {
    yield ["a", "link", "b"]; throw new Error("private backend detail");
  } };
  const text = await queryResponse(source, '(a link ?x)', new AbortController().signal).text();
  expect(text).toContain('"type":"row"');
  expect(text).toContain('"type":"error","code":"Storage"');
  expect(text).not.toContain('"type":"done"');
  expect(text).not.toContain('private backend detail');
});

test("HTTP reader cancellation signals storage and stops further pulls", async () => {
  let reads = 0, closed = false;
  let signal: AbortSignal | undefined;
  const source: FactSource = { supports: () => true, async *scan(_, s) {
    signal = s;
    try { reads++; yield ["a", "link", "b"]; reads++; yield ["a", "link", "c"]; }
    finally { closed = true; }
  } };
  const reader = queryResponse(source, '(a link ?x)', new AbortController().signal).body!.getReader();
  await reader.read(); await reader.cancel();
  expect(signal?.aborted).toBe(true);
  expect(reads).toBe(1);
  expect(closed).toBe(true);
});

test("budget after partial matches emits error without completion", async () => {
  const source: FactSource = { supports: () => true, async *scan() { yield ["a", "link", "b"]; yield ["a", "link", "c"]; } };
  const text = await queryResponse(source, '(a link ?x)', new AbortController().signal, { scans: 1, candidates: 100, rows: 1, milliseconds: 1000 }).text();
  expect(text).toContain('"type":"row"');
  expect(text).toContain('"code":"Budget"');
  expect(text).not.toContain('"type":"done"');
});
