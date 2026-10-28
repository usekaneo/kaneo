type ProviderError = {
  name?: unknown;
  status?: unknown;
  response?: { headers?: Record<string, unknown> };
};

/** Timeouts, network failures, rate limits and 5xx responses may succeed later. */
export function isTransientProviderError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { name, status, response } = error as ProviderError;
  if (typeof status !== "number")
    return ["AbortError", "TimeoutError", "TypeError"].includes(String(name));
  const headers = response?.headers ?? {};
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    // GitHub reports exhausted and secondary rate limits as 403.
    (status === 403 &&
      (headers["x-ratelimit-remaining"] === "0" ||
        headers["retry-after"] !== undefined))
  );
}
