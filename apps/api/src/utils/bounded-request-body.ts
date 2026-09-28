import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

/** Bound actual bytes before any JSON/form parser, even for misleading headers. */
export function boundedRequestBody(
  maxBytes: number,
  timeoutMs = 5_000,
): MiddlewareHandler {
  return async (c, next) => {
    const body = c.req.raw.body;
    if (!body) return next();
    const declared = Number(c.req.header("content-length"));
    if (declared > maxBytes) {
      void body.cancel().catch(() => {});
      throw new HTTPException(413, { message: "Request body is too large" });
    }
    // Always count actual bytes, including chunked bodies and misleading length
    // headers. Do not parse JSON/form data until this bounded read completes.
    const reader = body.getReader();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const read = async () => {
        // A fixed buffer also bounds memory for adversarial one-byte chunks.
        const bytes = new Uint8Array(maxBytes);
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (size + value.byteLength > maxBytes) {
            void reader.cancel().catch(() => {});
            throw new HTTPException(413, {
              message: "Request body is too large",
            });
          }
          bytes.set(value, size);
          size += value.byteLength;
        }
        return bytes.subarray(0, size);
      };
      const bytes = await Promise.race([
        read(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(
              new HTTPException(408, { message: "Request body timed out" }),
            );
            void reader.cancel().catch(() => {});
          }, timeoutMs);
        }),
      ]);
      const headers = new Headers(c.req.raw.headers);
      headers.set("content-length", String(bytes.byteLength));
      headers.delete("transfer-encoding");
      c.req.raw = new Request(c.req.raw, { headers, body: bytes });
    } finally {
      clearTimeout(timeout);
      reader.releaseLock();
    }
    return next();
  };
}
