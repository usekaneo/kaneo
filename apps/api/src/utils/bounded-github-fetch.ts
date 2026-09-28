// Import pages have bounded counts, but cap the decoded HTTP body as well.
export const MAX_GITHUB_IMPORT_RESPONSE_BYTES = 16 * 1024 * 1024;
export const GITHUB_IMPORT_REQUEST_TIMEOUT_MS = 10_000;

export const boundedGithubFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("GitHub import request timed out"));
    }, GITHUB_IMPORT_REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await fetch(input, {
          ...init,
          redirect: "error",
          signal: init?.signal
            ? AbortSignal.any([init.signal, controller.signal])
            : controller.signal,
        });
        if (controller.signal.aborted) {
          void response.body?.cancel().catch(() => {});
          throw new Error("GitHub import request timed out");
        }
        reader = response.body?.getReader();
        // Fixed storage also bounds overhead when a stream uses tiny chunks.
        const bytes = new Uint8Array(MAX_GITHUB_IMPORT_RESPONSE_BYTES);
        let size = 0;
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_GITHUB_IMPORT_RESPONSE_BYTES)
              throw new Error("GitHub import response is too large");
            bytes.set(value, size - value.byteLength);
          }
        }
        return new Response(
          response.status === 204 || response.status === 304
            ? null
            : bytes.subarray(0, size),
          {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          },
        );
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) {
      void reader.cancel().catch(() => {});
    }
  }
};
