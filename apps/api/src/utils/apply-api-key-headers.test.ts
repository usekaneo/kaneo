import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";
import { applyApiKeyHeaders } from "./apply-api-key-headers";

function appWith(
  cacheControl: string | null,
  apiKeyHeaders?: Record<string, string>,
) {
  const app = new Hono<{
    Variables: { apiKeyHeaders?: Record<string, string> };
  }>();
  app.use("*", applyApiKeyHeaders);
  app.get("/", (c) => {
    if (apiKeyHeaders) c.set("apiKeyHeaders", apiKeyHeaders);
    return new Response("asset", {
      headers: cacheControl ? { "Cache-Control": cacheControl } : {},
    });
  });
  return app;
}

const limitHeaders = {
  "X-RateLimit-Limit": "100",
  "X-RateLimit-Remaining": "99",
  "X-RateLimit-Reset": "1767225660",
};

describe("applyApiKeyHeaders", () => {
  it("adds the key's headers to the response", async () => {
    const response = await appWith("no-store", limitHeaders).request("/");

    expect(response.headers.get("x-ratelimit-remaining")).toBe("99");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    [null, "private"],
    ["public, max-age=300", "private, max-age=300"],
    ["max-age=60", "private, max-age=60"],
    ["private, max-age=60", "private, max-age=60"],
    ["no-store", "no-store"],
  ])(
    "keeps per-key headers out of shared caches when Cache-Control is %s",
    async (cacheControl, expected) => {
      const response = await appWith(cacheControl, limitHeaders).request("/");

      expect(response.headers.get("x-ratelimit-limit")).toBe("100");
      expect(response.headers.get("cache-control")).toBe(expected);
    },
  );

  it("marks a Retry-After-only response private", async () => {
    const response = await appWith(null, { "Retry-After": "42" }).request("/");

    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("private");
  });

  it("leaves responses without key headers untouched", async () => {
    for (const cacheControl of ["public, max-age=300", null]) {
      for (const headers of [undefined, {}]) {
        const response = await appWith(cacheControl, headers).request("/");

        expect(response.headers.get("cache-control")).toBe(cacheControl);
        expect(response.headers.get("x-ratelimit-limit")).toBeNull();
      }
    }
  });
});
