import { describe, expect, it } from "vite-plus/test";
import { normalizeCustomOAuthRequest } from "./normalize-custom-oauth-request";

describe("custom OAuth compatibility", () => {
  it("forwards the registered callback with its state and cookies intact", async () => {
    const request = new Request(
      "https://api.example.com/api/auth/oauth2/callback/custom?code=code&state=state",
      { headers: { cookie: "oauth_state=state" } },
    );
    const normalized = await normalizeCustomOAuthRequest(request);

    expect(normalized.url).toBe(
      "https://api.example.com/api/auth/callback/custom?code=code&state=state",
    );
    expect(normalized.headers.get("cookie")).toBe("oauth_state=state");
  });

  it("preserves older sign-in clients and their CAPTCHA headers", async () => {
    const body = {
      providerId: "custom",
      callbackURL: "https://web.example.com/dashboard",
      errorCallbackURL: "https://web.example.com/auth/sign-in",
      requestSignUp: true,
    };
    const request = new Request(
      "https://api.example.com/api/auth/sign-in/oauth2",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(JSON.stringify(body).length),
          "x-turnstile-token": "captcha-token",
        },
        body: JSON.stringify(body),
      },
    );
    const normalized = await normalizeCustomOAuthRequest(request);

    expect(new URL(normalized.url).pathname).toBe("/api/auth/sign-in/social");
    expect(await normalized.json()).toEqual({ ...body, provider: "custom" });
    expect(normalized.headers.get("x-turnstile-token")).toBe("captcha-token");
    expect(normalized.headers.has("content-length")).toBe(false);
    expect(await request.json()).toEqual(body);
  });

  it.each([
    ["/api/auth/callback/github", "GET", undefined],
    ["/api/auth/sign-in/social", "POST", '{"provider":"github"}'],
    ["/api/auth/sign-in/oauth2", "POST", '{"providerId":"github"}'],
    ["/api/auth/sign-in/oauth2", "POST", "malformed"],
    ["/api/auth/sign-in/oauth2", "POST", "null"],
  ] as const)(
    "leaves other requests intact: %s %s %s",
    async (path, method, body) => {
      const request = new Request(`https://api.example.com${path}`, {
        method,
        body,
      });
      expect(await normalizeCustomOAuthRequest(request)).toBe(request);
    },
  );
});
