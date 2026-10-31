import { Agent, fetch } from "undici";
import { withoutOutboundTelemetry } from "../../utils/sensitive-outbound";
import { parseTangledApiOrigin } from "./api-url";
import { createTangledLookup } from "./public-lookup";

const MAX_RESPONSE_BYTES = 1_048_576;
const agent = new Agent({
  connect: { lookup: createTangledLookup(), timeout: 5_000 },
  headersTimeout: 10_000,
  bodyTimeout: 10_000,
  maxHeaderSize: 16_384,
});

export async function requestTangledJson(url: URL): Promise<unknown> {
  parseTangledApiOrigin(url.origin);
  if (url.username || url.password || url.hash) {
    throw new Error(
      "Tangled API request cannot contain credentials or a fragment",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("Tangled API request timed out")),
    10_000,
  );
  timer.unref();
  let response: Awaited<ReturnType<typeof fetch>> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancelRead = () => {
    void reader?.cancel().catch(() => {});
  };

  try {
    response = await withoutOutboundTelemetry(() =>
      fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "application/json" },
        dispatcher: agent,
        signal: controller.signal,
      }),
    );
    if (!response.ok) {
      throw new Error(`Tangled read API returned HTTP ${response.status}`);
    }
    if (
      !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(
        response.headers.get("content-type") ?? "",
      )
    ) {
      throw new Error("Tangled read API did not return JSON");
    }
    const declaredSize = Number(response.headers.get("content-length"));
    if (declaredSize > MAX_RESPONSE_BYTES)
      throw new Error("Tangled API response is too large");
    if (!response.body) throw new Error("Tangled read API returned empty JSON");

    reader = response.body.getReader();
    controller.signal.addEventListener("abort", cancelRead, { once: true });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      controller.signal.throwIfAborted();
      const { done, value } = await reader.read();
      controller.signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES)
        throw new Error("Tangled API response is too large");
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new Error("Tangled read API returned invalid JSON");
    }
  } catch (error) {
    controller.signal.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", cancelRead);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    } else {
      await response?.body?.cancel().catch(() => {});
    }
  }
}
