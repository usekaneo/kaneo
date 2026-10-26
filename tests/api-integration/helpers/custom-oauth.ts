import { expect, vi } from "vite-plus/test";
import type { createApp } from "../../../apps/api/src/index";

type App = ReturnType<typeof createApp>["app"];

export const CUSTOM_OAUTH_CALLBACK_URL = "http://localhost:5173/dashboard";

function encodeSegment(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

// Better Auth decodes the id_token from the token response without checking its signature.
function unsignedIdToken(claims: Record<string, unknown>) {
  return `${encodeSegment({ alg: "none", typ: "JWT" })}.${encodeSegment(claims)}.signature`;
}

function readCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => {
      const [name, ...value] = pair.split("=");
      return Boolean(name) && value.join("=") !== "";
    })
    .join("; ");
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return input.url;
  return input instanceof URL ? input.href : input;
}

export async function signInWithCustomOAuth(
  app: App,
  claims: Record<string, unknown>,
  callbackPath = "/api/auth/oauth2/callback/custom",
) {
  const start = await app.request("/api/auth/sign-in/oauth2", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      providerId: "custom",
      callbackURL: CUSTOM_OAUTH_CALLBACK_URL,
    }),
  });
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  expect(state).toBeTruthy();

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const target = requestUrl(input);
    if (target !== process.env.CUSTOM_OAUTH_TOKEN_URL) {
      throw new Error(`Unexpected request to ${target}`);
    }
    return Response.json({
      access_token: "access-token",
      token_type: "Bearer",
      expires_in: 300,
      id_token: unsignedIdToken(claims),
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  return app.request(
    `${callbackPath}?code=test-code&state=${encodeURIComponent(state ?? "")}`,
    { headers: { cookie: readCookies(start) } },
  );
}
