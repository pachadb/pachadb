import { Effect } from "effect";
import { mergeWave } from "./parallel";

// Symbol equality follows the existing Rust query engine (URI/text distinctions
// are not yet part of its surface syntax). Storage adapters own value decoding.
export type Term = { readonly kind: "variable"; readonly name: string } | { readonly kind: "symbol"; readonly value: string };
export type Pattern = readonly [Term, Term, Term];
export type Fact = readonly [string, string, string];
export type BoundPattern = readonly [string | undefined, string | undefined, string | undefined];
export type Row = Readonly<Record<string, string>>;
export class QueryError extends Error {
  constructor(readonly code: "Parse" | "Unsupported" | "Budget" | "Storage" | "Cancelled", message: string) { super(message); }
}
export interface FactSource {
  /** Whether a selective scan exists for these bindings. No implicit full scan. */
  supports(pattern: BoundPattern): boolean;
  /** Advisory relative scan cost; never affects matching semantics. */
  cost?(pattern: BoundPattern): number;
  metrics?(): Readonly<Record<string, number>>;
  scan(pattern: BoundPattern, signal?: AbortSignal): AsyncIterable<Fact>;
}

export function parse(query: string): readonly Pattern[] {
  if (query.length > 16_384) throw new QueryError("Budget", "Query text too large");
  const text = query.trim();
  if (!text.startsWith("(") || !text.endsWith(")")) throw new QueryError("Parse", "Expected parenthesized triples");
  const terms: Term[] = [];
  const inner = text.slice(1, -1);
  let offset = 0;
  while (offset < inner.length) {
    if (/\s/.test(inner[offset] ?? "")) { offset++; continue; }
    const tail = inner.slice(offset);
    const match = /^("(?:[^"\\]|\\.)*"|\?[a-zA-Z:\-\/._0-9]+|[a-zA-Z:\-\/._0-9]+)/.exec(tail);
    const token = match?.[0];
    if (!token) throw new QueryError("Parse", `Invalid term at offset ${offset + 1}; nested/equality forms are not supported yet`);
    offset += token.length;
    if (offset < inner.length && !/\s/.test(inner[offset] ?? "")) throw new QueryError("Parse", "Terms must be separated by whitespace");
    if (token.startsWith("?")) terms.push({ kind: "variable", name: token });
    else {
      let value = token;
      if (token.startsWith('"')) {
        try { value = JSON.parse(token) as string; } catch { throw new QueryError("Parse", "Invalid quoted string escape"); }
      }
      terms.push({ kind: "symbol", value });
    }
  }
  if (!terms.length || terms.length % 3) throw new QueryError("Parse", "Expected one or more complete triples");
  if (terms.length > 96) throw new QueryError("Budget", "At most 32 patterns");
  const patterns: Pattern[] = [];
  for (let i = 0; i < terms.length; i += 3) {
    const a = terms[i], b = terms[i + 1], c = terms[i + 2];
    if (a && b && c) patterns.push([a, b, c]);
  }
  return patterns;
}

export interface Limits { readonly scans: number; readonly candidates: number; readonly rows: number; readonly milliseconds: number }
const defaults: Limits = { scans: 2000, candidates: 100_000, rows: 20_000, milliseconds: 20_000 };
export interface Metrics { scans: number; candidates: number; intermediates: number }
export type QueryEvent = { readonly type: "row"; readonly row: Row } | { readonly type: "done"; readonly rows: number; readonly metrics: Metrics };

/** Pull-based distinct joins. No final rows or whole scans are required before yielding. */
export async function* streamQuery(source: FactSource, query: string, limits: Limits = defaults, signal?: AbortSignal, concurrency = 1): AsyncGenerator<QueryEvent, void> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new QueryError("Budget", "Concurrency must be 1..8");
  for (const n of Object.values(limits)) if (!Number.isSafeInteger(n) || n < 1) throw new QueryError("Budget", "Invalid query limits");
  const patterns = parse(query);
  const executionAbort = new AbortController();
  signal = signal ? AbortSignal.any([signal, executionAbort.signal]) : executionAbort.signal;
  const started = Date.now();
  const metrics = { scans: 0, candidates: 0, intermediates: 0 };
  const cache = new Map<string, readonly Fact[]>();
  let cacheBytes = 0;
  const seen = new Set<string>();
  let seenBytes = 0;
  const encoder = new TextEncoder();
  const headers = [...new Set(patterns.flatMap(p => p.filter(t => t.kind === "variable").map(t => t.name)))].sort();
  const checkTime = () => {
    if (signal?.aborted) throw new QueryError("Cancelled", "Query cancelled");
    if (Date.now() - started > limits.milliseconds) throw new QueryError("Budget", "Query deadline exceeded");
  };
  const resolve = (term: Term, row: Row) => term.kind === "symbol" ? term.value : row[term.name];
  const bind = (p: Pattern, row: Row): BoundPattern => [resolve(p[0], row), resolve(p[1], row), resolve(p[2], row)];
  async function* visit(remaining: readonly Pattern[], row: Row, root = false): AsyncGenerator<Row> {
    checkTime();
    if (!remaining.length) {
      const key = JSON.stringify(headers.map(h => row[h]));
      if (seen.has(key)) return;
      seenBytes += encoder.encode(key).byteLength;
      if (seen.size >= limits.rows || seenBytes > 4 * 1024 * 1024) throw new QueryError("Budget", "Result distinct-state budget exceeded");
      seen.add(key);
      yield row;
      return;
    }
    // Plan per binding: prefer a supported pattern with most bound terms.
    const choices = remaining.map((p, index) => ({ p, index, bound: bind(p, row) }))
      .filter(c => source.supports(c.bound)).sort((a, b) => b.bound.filter(v => v !== undefined).length - a.bound.filter(v => v !== undefined).length || (source.cost?.(a.bound) ?? 0) - (source.cost?.(b.bound) ?? 0));
    const choice = choices[0];
    if (!choice) throw new QueryError("Unsupported", "No selective index for remaining patterns");
    const scanPattern = choice.bound;
    const key = JSON.stringify(scanPattern);
    const cached = cache.get(key);
    async function* scan(): AsyncGenerator<Fact> {
      if (cached) { yield* cached; return; }
      if (++metrics.scans > limits.scans) throw new QueryError("Budget", "Scan budget exceeded");
      let loaded: Fact[] | undefined = [];
      let bytes = encoder.encode(key).byteLength;
      for await (const fact of source.scan(scanPattern, signal)) {
        checkTime();
        if (++metrics.candidates > limits.candidates) throw new QueryError("Budget", "Candidate budget exceeded");
        bytes += encoder.encode(JSON.stringify(fact)).byteLength;
        // Bound each in-progress cache buffer; completed caches share a separate cap.
        if (bytes > 32 * 1024) loaded = undefined;
        loaded?.push(fact);
        yield fact;
      }
      // Never cache a partial scan after cancellation or failure.
      if (loaded && cacheBytes + bytes <= 1024 * 1024) {
        cache.set(key, loaded);
        cacheBytes += bytes;
      }
    }
    const rest = remaining.filter((_, i) => i !== choice.index);
    let wave: AsyncGenerator<Row>[] = [];
    for await (const fact of scan()) {
      checkTime();
      if (++metrics.intermediates > limits.candidates) throw new QueryError("Budget", "Join budget exceeded");
      const next: Record<string, string> = { ...row };
      let matches = true;
      for (const i of [0, 1, 2] as const) {
        const term = choice.p[i], value = fact[i];
        if (term.kind === "symbol") { if (term.value !== value) matches = false; }
        else if (next[term.name] !== undefined && next[term.name] !== value) matches = false;
        else next[term.name] = value;
      }
      if (matches) {
        if (root && concurrency > 1) {
          wave.push(visit(rest, next));
          if (wave.length === concurrency) { yield* mergeWave(wave, () => executionAbort.abort()); wave = []; }
        } else yield* visit(rest, next);
      }
    }
    if (wave.length) yield* mergeWave(wave, () => executionAbort.abort());
  }
  for await (const row of visit(patterns, {}, true)) yield { type: "row", row };
  checkTime();
  yield { type: "done", rows: seen.size, metrics: { ...metrics, ...source.metrics?.() } };
}

export async function evaluate(source: FactSource, query: string, limits: Limits = defaults) {
  const rows: Row[] = [];
  let metrics: Metrics = { scans: 0, candidates: 0, intermediates: 0 };
  for await (const event of streamQuery(source, query, limits)) {
    if (event.type === "row") rows.push(event.row);
    else metrics = event.metrics;
  }
  const key = (row: Row) => JSON.stringify(Object.keys(row).sort().map(k => row[k]));
  rows.sort((a, b) => key(a).localeCompare(key(b)));
  return { rows, metrics };
}

/** Effect application boundary; expected parse/planning/budget/storage failures stay typed. */
export const queryFacts = (source: FactSource, text: string, limits?: Limits) => Effect.tryPromise({
  try: () => evaluate(source, text, limits),
  catch: (cause) => cause instanceof QueryError ? cause : new QueryError("Storage", "Fact scan failed"),
});
