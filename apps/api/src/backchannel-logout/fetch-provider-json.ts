import { LogoutProviderUnavailable } from "./errors";

const PROVIDER_TIMEOUT_MS = 5_000;
export const MAX_PROVIDER_DOCUMENT_BYTES = 64 * 1024;

export async function fetchProviderJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw new LogoutProviderUnavailable(`${url} could not be fetched`);
  }

  const reader = response.ok ? response.body?.getReader() : undefined;
  if (!reader) {
    void response.body?.cancel().catch(() => {});
    throw new LogoutProviderUnavailable(
      `${url} answered HTTP ${response.status}`,
    );
  }

  const bytes = new Uint8Array(MAX_PROVIDER_DOCUMENT_BYTES);
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > MAX_PROVIDER_DOCUMENT_BYTES) {
        throw new LogoutProviderUnavailable(
          `${url} answered with too much data`,
        );
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)));
  } catch (error) {
    if (error instanceof LogoutProviderUnavailable) throw error;
    throw new LogoutProviderUnavailable(
      `${url} did not answer with a JSON document`,
    );
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
