import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { vi } from "vite-plus/test";
import { BACKCHANNEL_LOGOUT_EVENT } from "../../../apps/api/src/backchannel-logout/verify-logout-token";
import type { createApp } from "../../../apps/api/src/index";

type App = ReturnType<typeof createApp>["app"];

export const LOGOUT_CLIENT_ID = "kaneo-test";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const signingKey = {
  ...publicKey.export({ format: "jwk" }),
  kid: "test-key",
  use: "sig",
};

function encodeSegment(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return input.url;
  return input instanceof URL ? input.href : input;
}

export function enableBackchannelLogout() {
  const issuer = `https://idp.example.com/realms/${randomUUID()}`;
  const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
  const jwksUri = `${issuer}/protocol/openid-connect/certs`;
  vi.stubEnv("CUSTOM_OAUTH_BACKCHANNEL_LOGOUT", "true");
  vi.stubEnv("CUSTOM_OAUTH_DISCOVERY_URL", discoveryUrl);
  vi.stubEnv("CUSTOM_OAUTH_CLIENT_ID", LOGOUT_CLIENT_ID);

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const target = requestUrl(input);
    if (target === discoveryUrl) {
      return Response.json({
        issuer,
        jwks_uri: jwksUri,
        id_token_signing_alg_values_supported: ["RS256", "HS256"],
      });
    }
    if (target === jwksUri) return Response.json({ keys: [signingKey] });
    return new Response("Not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { issuer, discoveryUrl, fetchMock };
}

export function signLogoutToken(
  issuer: string,
  claims: Record<string, unknown> = {},
) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "logout+jwt", kid: "test-key" };
  const payload = {
    iss: issuer,
    aud: LOGOUT_CLIENT_ID,
    iat: now,
    exp: now + 120,
    jti: randomUUID(),
    events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
    ...claims,
  };
  const input = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  return `${input}.${sign("sha256", Buffer.from(input), privateKey).toString("base64url")}`;
}

export function postLogoutToken(app: App, logoutToken: string) {
  return app.request("/api/auth/oauth2/backchannel-logout/custom", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ logout_token: logoutToken }).toString(),
  });
}
