import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../../../apps/api/src/utils/verify-turnstile";

describe("verifyTurnstile", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalSecret;
    }
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns ok when no secret is configured (self-hosted opt-out)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const result = await verifyTurnstile("any-token", "1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("fails when the token is missing", async () => {
    const result = await verifyTurnstile(null);
    expect(result.ok).toBe(false);
  });

  it("posts the secret, token, and remoteip to Cloudflare", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await verifyTurnstile("good-token", "203.0.113.7");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    const body = (init as { body: URLSearchParams }).body;
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("good-token");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it("returns the cloudflare error codes on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    }) as unknown as typeof fetch;

    const result = await verifyTurnstile("bad-token");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("invalid-input-response");
    }
  });

  it("fails gracefully when the fetch throws", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await verifyTurnstile("token");
    expect(result.ok).toBe(false);
  });
});
