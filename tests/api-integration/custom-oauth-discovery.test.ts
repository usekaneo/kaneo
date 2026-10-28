import { afterAll, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";

const { fetchMock } = vi.hoisted(() => {
  process.env.CUSTOM_OAUTH_CLIENT_ID = "kaneo-test";
  process.env.CUSTOM_OAUTH_CLIENT_SECRET = "kaneo-test-secret";
  process.env.CUSTOM_OAUTH_DISCOVERY_URL =
    "https://idp.example.com/.well-known/openid-configuration";
  process.env.CUSTOM_OAUTH_AUTHORIZATION_URL = "";
  process.env.CUSTOM_OAUTH_TOKEN_URL = "";
  process.env.CUSTOM_OAUTH_USER_INFO_URL = "";

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === process.env.CUSTOM_OAUTH_DISCOVERY_URL) {
        return Response.json({
          issuer: "https://idp.example.com",
          authorization_endpoint: "https://idp.example.com/authorize",
          token_endpoint: "https://idp.example.com/token",
          userinfo_endpoint: "https://idp.example.com/userinfo",
        });
      }
      if (url === "https://idp.example.com/token") {
        return Response.json({
          access_token: "access-token",
          token_type: "Bearer",
          expires_in: 300,
        });
      }
      throw new Error(`Unexpected request to ${url}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
});

afterAll(() => vi.unstubAllGlobals());

describe("custom OAuth discovery compatibility", () => {
  it("discovers endpoints while keeping the registered redirect URI", async () => {
    const context = await auth.$context;
    const provider = context.socialProviders.find((p) => p.id === "custom");
    expect(provider).toBeDefined();
    if (!provider) throw new Error("Custom provider was not registered");

    const authorization = await provider.createAuthorizationURL({
      state: "oauth-state",
      codeVerifier: "code-verifier",
      redirectURI: "http://localhost:1337/api/auth/callback/custom",
    });
    expect(authorization.origin + authorization.pathname).toBe(
      "https://idp.example.com/authorize",
    );
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      "http://localhost:1337/api/auth/oauth2/callback/custom",
    );

    const tokens = await provider.validateAuthorizationCode({
      code: "authorization-code",
      codeVerifier: "code-verifier",
      redirectURI: "http://localhost:1337/api/auth/callback/custom",
    });
    expect(tokens?.accessToken).toBe("access-token");
    const [, tokenRequest] =
      fetchMock.mock.calls.find(
        ([input]) => String(input) === "https://idp.example.com/token",
      ) ?? [];
    const tokenBody = new URLSearchParams(tokenRequest?.body?.toString());
    expect(tokenBody.get("redirect_uri")).toBe(
      "http://localhost:1337/api/auth/oauth2/callback/custom",
    );
  });
});
