import { assertPublicDestination } from "./assert-public-destination";
import { withoutOutboundTelemetry } from "./sensitive-outbound";

type Failure = "timeout" | "http" | "network" | "response" | "destination";

// Never attach the original error/cause: it can include credential-bearing
// URLs, authorization headers or untrusted response bodies.
export class OutboundRequestError extends Error {
  constructor(
    readonly reason: Failure,
    readonly status?: number,
  ) {
    super(
      `Outbound request failed: ${reason}${status ? ` (HTTP ${status})` : ""}`,
    );
  }
}

export function safeOutboundError(error: unknown): string {
  return error instanceof OutboundRequestError
    ? error.message
    : "Outbound request failed";
}

async function readSmallJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new OutboundRequestError("response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) throw new OutboundRequestError("response");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new OutboundRequestError("response");
    }
  } finally {
    // Cancellation need not wait for the remote peer to close its stream.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function sendOutboundRequest(
  url: string,
  init: Pick<RequestInit, "headers" | "body">,
  options: {
    readJson?: boolean;
    publicDestination?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new OutboundRequestError("timeout"));
    }, options.timeoutMs ?? 10_000);
  });
  const request = async () => {
    if (options.publicDestination) {
      try {
        await assertPublicDestination(url, "Notification");
      } catch {
        throw new OutboundRequestError("destination");
      }
    }
    // DNS validation may finish after the deadline. Never start a late request.
    controller.signal.throwIfAborted();
    const response = await withoutOutboundTelemetry(() =>
      fetch(url, {
        ...init,
        method: "POST",
        redirect: "error",
        signal: controller.signal,
      }),
    );
    if (!response.ok || !options.readJson) {
      void response.body?.cancel().catch(() => {});
      if (!response.ok) throw new OutboundRequestError("http", response.status);
      return undefined;
    }
    return readSmallJson(response);
  };
  try {
    return await Promise.race([request(), deadline]);
  } catch (error) {
    if (controller.signal.aborted) throw new OutboundRequestError("timeout");
    if (error instanceof OutboundRequestError) throw error;
    throw new OutboundRequestError("network");
  } finally {
    clearTimeout(timer);
  }
}
