// Starts workerd via Wrangler; Bun is only the test orchestrator, not the Worker runtime.
export {};
const port = 18879;
const base = `http://127.0.0.1:${port}`;
const proc = Bun.spawn(["node", "apps/worker/node_modules/wrangler/bin/wrangler.js", "dev", "--config", "apps/worker/wrangler.jsonc", "--ip", "127.0.0.1", "--port", String(port)], {
  stdout: "inherit", stderr: "inherit",
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.status === 404) { ready = true; break; }
    } catch { /* workerd not ready yet */ }
    await Bun.sleep(500);
  }
  if (!ready) throw new Error("Wrangler dev server did not become ready");
  for (const run of ["atomicity", "pagination"] as const) {
    const response = await fetch(`${base}/spike`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ run }), signal: AbortSignal.timeout(30_000),
    });
    const body: unknown = await response.json();
    console.log(run, body);
    if (!response.ok || typeof body !== "object" || body === null || !("pass" in body) || body.pass !== true) {
      throw new Error(`${run} failed`);
    }
  }
} finally {
  proc.kill();
  await proc.exited;
}
