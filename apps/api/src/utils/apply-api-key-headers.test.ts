import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";
import { applyApiKeyHeaders } from "./apply-api-key-headers";

function appWith(cacheControl: string, apiKeyHeaders?: Record<string, string>) {
  const app = new Hono<{
    Variables: { apiKeyHeaders?: Record<string, string> };
  }>();
  app.use("*", applyApiKeyHeaders);
  app.get("/", (c) => {
    if (apiKeyHeaders) c.set("apiKeyHeaders", apiKeyHeaders);
    return new Response("asset", {
      headers: { "Cache-Control": cacheControl },
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

  it("keeps per-key headers out of shared caches", async () => {
    const response = await appWith("public, max-age=300", limitHeaders).request(
      "/",
    );

    expect(response.headers.get("x-ratelimit-limit")).toBe("100");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
  });

  it("leaves responses without key headers untouched", async () => {
    for (const headers of [undefined, {}]) {
      const response = await appWith("public, max-age=300", headers).request(
        "/",
      );

      expect(response.headers.get("cache-control")).toBe("public, max-age=300");
      expect(response.headers.get("x-ratelimit-limit")).toBeNull();
    }
  });
});
