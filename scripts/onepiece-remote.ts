// Bounded authenticated pilot; run the local oracle first. No XML/wikitext leaves the machine.
export {};
interface Page { id: string; title: string; links: string[] }
interface Manifest { pages: number; paths: Array<{ hops: number; ids: string[] }> }
const total = Number(Bun.argv[2] ?? "50");
if (!Number.isSafeInteger(total) || total < 1 || total > 500) throw new Error("pilot pages must be 1..500");
const fixture: { manifest: Manifest; pages: Page[] } = await Bun.file(".fixtures/onepiece/graph-500.json").json();
if (fixture.pages.length !== 500) throw new Error("run the 500-page oracle first");
const url = Bun.env["ONEPIECE_URL"] ?? "https://pachadb.leostera.dev";
let token: string | undefined;
if (url === "https://pachadb.leostera.dev") {
  const tokenProcess = Bun.spawn(["cf", "access", "token", url], { stdout: "pipe", stderr: "ignore" });
  token = (await new Response(tokenProcess.stdout).text()).trim();
  if (await tokenProcess.exited || token.split(".").length !== 3) throw new Error("authenticate to Access with cf access login first");
} else if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) {
  throw new Error("only the Access-protected host or local loopback is allowed");
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { ...(token ? { "cf-access-jwt-assertion": token } : {}), "content-type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<T>;
}
const started = performance.now();
let written = 0;
let skipped = 0;
for (let at = 0; at < total; at += 5) {
  const result = await post<{ written: number; skipped: number }>("/graph/ingest", { pages: fixture.pages.slice(at, Math.min(at + 5, total)) });
  written += result.written;
  skipped += result.skipped;
  if ((at + 5) % 50 === 0 || at + 5 >= total) console.log({ acknowledged: Math.min(at + 5, total), written, skipped, elapsedMs: Math.round(performance.now() - started) });
}
let checked = 0;
let links = 0;
for (let at = 0; at < total; at += 5) {
  const result = await post<{ checked: number; links: number }>("/graph/verify", { pages: fixture.pages.slice(at, Math.min(at + 5, total)) });
  checked += result.checked;
  links += result.links;
}
const expectedLinks = fixture.pages.slice(0, total).reduce((n, p) => n + p.links.length, 0);
console.log({ verifiedPages: checked, verifiedLinks: links, expectedLinks });
if (checked !== total || links !== expectedLinks) throw new Error("graph read-back mismatch");
if (total === 500) {
  const edgeMap = new Map(fixture.pages.map(p => [p.id, p.links]));
  for (const path of fixture.manifest.paths) {
    const start = path.ids[0]!;
    const end = path.ids.at(-1)!;
    const queryStarted = performance.now();
    const result = await post<{ path: string[] | null; found: boolean; scanned: number; pagesRead: number }>("/graph/path", { start, end, hops: path.hops });
    const valid = result.path?.length === path.hops + 1 && result.path[0] === start && result.path.at(-1) === end && result.path.slice(1).every((id, i) => edgeMap.get(result.path![i]!)?.includes(id));
    console.log({ hops: path.hops, elapsedMs: Math.round(performance.now() - queryStarted), expectedOnePath: path.ids, result, valid });
    if (!result.found || !valid) throw new Error(`${path.hops}-hop query did not match local graph`);
  }
}
