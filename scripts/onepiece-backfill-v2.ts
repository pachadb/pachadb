export {};
// Isolated, operator-controlled offline migration; do not run competing importers.
const raw: unknown = await Bun.file(".fixtures/onepiece/graph-500.json").json();
if (!raw || typeof raw !== "object" || !("pages" in raw) || !Array.isArray(raw.pages) || raw.pages.length !== 500) throw new Error("Expected 500-page fixture");
const pages: { id: string; title: string; links: string[]; incoming: string[] }[] = [];
for (const p of raw.pages) {
  if (!p || typeof p !== "object" || typeof p.id !== "string" || typeof p.title !== "string" || !Array.isArray(p.links) || !p.links.every((s: unknown) => typeof s === "string")) throw new Error("Invalid page");
  pages.push({ id: p.id, title: p.title, links: p.links, incoming: [] });
}
const byId = new Map(pages.map(p => [p.id, p]));
if (byId.size !== 500) throw new Error("Duplicate page IDs");
for (const p of pages) for (const to of p.links) {
  const target = byId.get(to);
  if (!target) throw new Error("Unresolved link");
  target.incoming.push(p.id);
}
const edges = pages.reduce((sum, p) => sum + p.links.length, 0);
if (edges !== 5425) throw new Error("Baseline edge count mismatch");
const url = Bun.env["ONEPIECE_URL"] ?? "https://pachadb.leostera.dev";
let token: string | undefined;
if (url === "https://pachadb.leostera.dev") {
  const proc = Bun.spawn(["cf", "access", "token", url], { stdout: "pipe", stderr: "ignore" });
  token = (await new Response(proc.stdout).text()).trim();
  if (await proc.exited || token.split(".").length !== 3) throw new Error("Access login required");
} else if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error("Unapproved target");
async function post(path: string, body: unknown) {
  const res = await fetch(`${url}/facts/v2/${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "cf-access-jwt-assertion": token } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Backfill ${path}: HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
for (const phase of ["ingest", "verify"] as const) {
  const started = performance.now();
  for (let i = 0; i < pages.length; i += 5) {
    await post(phase, { pages: pages.slice(i, i + 5) });
    if ((i + 5) % 100 === 0) console.log({ phase, pages: i + 5, elapsedMs: Math.round(performance.now() - started) });
  }
}
console.log(await post("seal", {}));
console.log({ pages: pages.length, outgoing: edges, incoming: edges, logicalItems: 500 + 2 * edges, verified: true });
