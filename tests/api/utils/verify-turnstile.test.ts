import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../../../apps/api/src/utils/verify-turnstile";

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  vi.stubEnv("KANEO_CLIENT_URL", "https://app.example.com");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Turnstile verification contract", () => {
  it.each([null, undefined, {}, "", "x".repeat(2049)])(
    "rejects missing or malformed tokens before network access (%s)",
    async (token) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      expect((await verifyTurnstile(token)).ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    { success: true, hostname: "other.example.com", action: "auth" },
    { success: true, hostname: "app.example.com", action: "other" },
    { success: true, hostname: "app.example.com" },
    { success: "true", hostname: "app.example.com", action: "auth" },
    { success: false, hostname: "app.example.com", action: "auth" },
  ])("rejects invalid verification context %j", async (payload) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload))),
    );
    expect((await verifyTurnstile("token")).ok).toBe(false);
  });
  it("requires strict success, the auth action and exact deployment hostname", async () => {
    const fetchMock = vi.fn(
      async (_url: unknown, _options: unknown) =>
        new Response(
          JSON.stringify({
            success: true,
            hostname: "app.example.com",
            action: "auth",
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile("token")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = options?.body;
    if (!(body instanceof URLSearchParams))
      throw new Error("Expected verification form body");
    expect(body.get("response")).toBe("token");
    expect(body.get("secret")).toBe("secret");
    expect(body.has("remoteip")).toBe(false);
  });
  it("fails closed on malformed JSON, HTTP failure or transport errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("invalid json"))
      .mockResolvedValueOnce(new Response("upstream secret", { status: 500 }))
      .mockRejectedValueOnce(new Error("upstream secret"));
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 3; i++)
      expect(await verifyTurnstile("token")).toEqual({
        ok: false,
        reason: "Captcha verification failed.",
      });
  });
  it("preserves explicit opt-out when no secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile(null)).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["5000ms", "1e3", "", "abc", "-100", "0", "5000"])(
    "keeps the bounded verifier contract with legacy TURNSTILE_TIMEOUT_MS=%p",
    async (raw) => {
      vi.stubEnv("TURNSTILE_TIMEOUT_MS", raw);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            action: "auth",
            hostname: "app.example.com",
          }),
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await verifyTurnstile("token");

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
});
