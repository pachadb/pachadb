import { expect, test } from "bun:test";
import { evaluate, parse, type Fact, type FactSource } from "../src/index";
const facts: Fact[] = [["a", "link", "b"], ["b", "link", "c"], ["a", "link", "a"], ["c", "title", "Sea King"], ["c", "title", "Sea King"]];
const source: FactSource = {
  supports: p => p[0] !== undefined && p[1] !== undefined,
  async *scan(p) { for (const f of facts) if (p.every((v, i) => v === undefined || v === f[i])) yield f; },
};
test("reorders joins and projects all variables with set semantics", async () => {
  const result = await evaluate(source, '(?end title ?name ?mid link ?end a link ?mid)');
  expect(result.rows).toEqual([{ "?mid": "b", "?end": "c", "?name": "Sea King" }]);
});
test("repeated variable enforces equality", async () => {
  expect((await evaluate(source, '(a link ?x ?x link ?x)')).rows).toEqual([{ "?x": "a" }]);
});
test("fully grounded true and false queries", async () => {
  expect((await evaluate(source, '(c title "Sea King")')).rows).toEqual([{}]);
  expect((await evaluate(source, '(c title "Wrong")')).rows).toEqual([]);
});
test("predicate variables bind when an adapter supports them", async () => {
  const all: FactSource = { ...source, supports: () => true };
  expect((await evaluate(all, '(a ?field b)')).rows).toEqual([{ "?field": "link" }]);
});
test("malformed and unsupported forms are explicit", async () => {
  for (const q of ['()', '(a b)', '(a b c d)', '(a b (x))', '(a b "bad\\q")']) expect(() => parse(q)).toThrow();
  await expect(evaluate(source, '(?x link ?y)')).rejects.toThrow("No selective index");
});
test("budget errors never return partial results", async () => {
  await expect(evaluate(source, '(a link ?x)', { scans: 1, candidates: 1, rows: 1, milliseconds: 1000 })).rejects.toThrow("budget exceeded");
});
