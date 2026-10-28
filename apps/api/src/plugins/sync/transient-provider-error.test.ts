import { expect, it } from "vite-plus/test";
import { isTransientProviderError } from "./transient-provider-error";

const http = (status: number, headers: Record<string, string> = {}) =>
  Object.assign(new Error("HTTP"), { status, response: { headers } });

it.each([
  [http(408), true],
  [http(429), true],
  [http(502), true],
  [http(403, { "x-ratelimit-remaining": "0" }), true],
  [http(403, { "retry-after": "30" }), true],
  [new TypeError("fetch failed"), true],
  [Object.assign(new Error("aborted"), { name: "AbortError" }), true],
  [http(403), false],
  [http(404), false],
  [http(401), false],
  [new Error("GitHub repository identity changed"), false],
  [undefined, false],
])("classifies %o as transient: %s", (error, transient) => {
  expect(isTransientProviderError(error)).toBe(transient);
});
