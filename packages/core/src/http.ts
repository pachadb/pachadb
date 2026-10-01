import { QueryError, streamQuery, type FactSource, type Limits } from "./index";

/** Terminal `done` is mandatory for completeness; HTTP 200 alone is not success. */
export function queryResponse(source: FactSource, query: string, requestSignal: AbortSignal, limits?: Limits, concurrency = 1): Response {
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  requestSignal.addEventListener("abort", onAbort, { once: true });
  if (requestSignal.aborted) abort.abort();
  const iterator = streamQuery(source, query, limits, abort.signal, concurrency);
  const encoder = new TextEncoder();
  const cleanup = () => requestSignal.removeEventListener("abort", onAbort);
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (cancelled) return;
        if (next.done) { cleanup(); controller.close(); return; }
        controller.enqueue(encoder.encode(`${JSON.stringify(next.value)}\n`));
        if (next.value.type === "done") {
          cleanup();
          controller.close();
          await iterator.return();
        }
      } catch (cause) {
        cleanup();
        if (cancelled) return;
        const error = cause instanceof QueryError ? cause : new QueryError("Storage", "Fact scan failed");
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", code: error.code, message: error.message })}\n`));
        controller.close();
      }
    },
    async cancel() {
      cancelled = true;
      abort.abort();
      cleanup();
      await iterator.return();
    },
  }, { highWaterMark: 0 });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
