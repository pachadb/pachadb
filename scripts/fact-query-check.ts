export {};
// Independent complete-path oracle: no imports from the PachaDB evaluator.
const raw: unknown = await Bun.file(".fixtures/onepiece/graph-500.json").json();
if (!raw || typeof raw !== "object" || !("pages" in raw) || !Array.isArray(raw.pages)) throw new Error("Invalid fixture");
const edges = new Map<string, string[]>();
for (const p of raw.pages) {
  if (!p || typeof p !== "object" || typeof p.id !== "string" || !Array.isArray(p.links) || !p.links.every((v: unknown) => typeof v === "string")) throw new Error("Invalid page");
  edges.set(`wiki:page:${p.id}`, p.links.map((id: string) => `wiki:page:${id}`));
}
const url = Bun.env["ONEPIECE_URL"] ?? "https://pachadb.leostera.dev";
let token: string | undefined;
if (url === "https://pachadb.leostera.dev") {
  const proc = Bun.spawn(["cf", "access", "token", url], { stdout: "pipe", stderr: "ignore" });
  token = (await new Response(proc.stdout).text()).trim();
  if (await proc.exited || token.split(".").length !== 3) throw new Error("Access login required");
} else if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error("Unapproved target");
const selective = Bun.env["QUERY_CASE"] === "selective";
for (const [hops, defaultEnd] of [[2, "1847"], [3, "1524"], [4, "1914"]] as const) {
  const endId = selective ? "1615" : defaultEnd;
  const start = "wiki:page:1439", end = `wiki:page:${endId}`;
  let paths = [[start]];
  for (let depth = 0; depth < hops; depth++) paths = paths.flatMap(path => (edges.get(path.at(-1)!) ?? []).filter(next => depth < hops - 1 || next === end).map(next => [...path, next]));
  // Datalog joins permit cycles; unlike /graph/path, do NOT eliminate repeated vertices.
  const expected = [...new Set(paths.map(path => JSON.stringify(path.slice(1, -1))))].sort();
  const terms = [start, ...Array.from({ length: hops - 1 }, (_, i) => `?v${i}`), end];
  const query = `(${terms.slice(0, -1).map((term, i) => `${term} wiki:page:link ${terms[i + 1]}`).join(" ")})`;
  const started = performance.now();
  const v2 = Bun.env["INDEX_VERSION"] === "v2";
  const concurrency = Number(Bun.env["CONCURRENCY"] ?? "1");
  const streaming = v2 || Bun.env["STREAM"] === "1";
  const endpoint = v2 ? "/facts/v2/stream" : `/facts/query${streaming ? "/stream" : ""}`;
  const response = await fetch(`${url}${endpoint}`,  { method: "POST", headers: { "content-type": "application/json", ...(token ? { "cf-access-jwt-assertion": token } : {}) }, body: JSON.stringify({ query, ...(v2 ? { concurrency } : {}) }), signal: AbortSignal.timeout(60_000) });
  let firstRowMs: number | undefined;
  let body: unknown;
  if (!streaming) body = await response.json();
  else {
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    const rows: Record<string, unknown>[] = [];
    let complete = false;
    let metrics: unknown;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += chunk.value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const event: unknown = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (!event || typeof event !== "object" || !("type" in event) || complete) throw new Error("Invalid stream event");
        if (event.type === "row" && "row" in event && typeof event.row === "object" && event.row !== null) {
          firstRowMs ??= Math.round(performance.now() - started);
          rows.push(event.row as Record<string, unknown>);
        } else if (event.type === "done" && "rows" in event && event.rows === rows.length) {
          complete = true;
          metrics = "metrics" in event ? event.metrics : null;
        } else throw new Error(`Stream failed: ${JSON.stringify(event)}`);
      }
    }
    if (!complete || buffer.length) throw new Error("Truncated stream: missing terminal done");
    body = { rows, metrics };
  }
  if (!response.ok || !body || typeof body !== "object" || !("rows" in body) || !Array.isArray(body.rows)) throw new Error(`Query failed: ${JSON.stringify(body)}`);
  const actual = body.rows.map((row: Record<string, unknown>) => JSON.stringify(Array.from({ length: hops - 1 }, (_, i) => row[`?v${i}`]))).sort();
  if (!expected.length || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Complete result mismatch at depth ${hops}: expected ${expected.length}, got ${actual.length}`);
  console.log(JSON.stringify({ hops, case: selective ? "selective" : "baseline", streaming, indexVersion: v2 ? "v2" : "v1", concurrency, firstRowMs, rows: actual.length, elapsedMs: Math.round(performance.now() - started), hash: new Bun.CryptoHasher("sha256").update(JSON.stringify(actual)).digest("hex"), metrics: "metrics" in body ? body.metrics : null }));
}
