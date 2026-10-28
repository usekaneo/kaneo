import type { GenericEndpointContext } from "better-auth";
import { describe, expect, it } from "vite-plus/test";
import {
  rememberSignInSessionId,
  takeSignInSessionId,
} from "../../../apps/api/src/backchannel-logout/sign-in-session-id";

const CALLBACK_PATH = "/callback/:id";

function endpointContext(
  context: object = {},
  path = CALLBACK_PATH,
  providerId = "custom",
) {
  return {
    path,
    params: { id: providerId },
    context,
  } as unknown as GenericEndpointContext;
}

function idToken(claims: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

describe("sign-in session ID", () => {
  it("hands the ID token's sid of a custom provider callback over once", () => {
    const ctx = endpointContext();
    rememberSignInSessionId(idToken({ sid: "kc-session-1" }), ctx);

    expect(takeSignInSessionId(ctx)).toBe("kc-session-1");
    expect(takeSignInSessionId(ctx)).toBeUndefined();
  });

  it("keeps the sids of concurrent callbacks apart", () => {
    const first = endpointContext();
    const second = endpointContext();
    rememberSignInSessionId(idToken({ sid: "kc-session-1" }), first);
    rememberSignInSessionId(idToken({ sid: "kc-session-2" }), second);

    expect(takeSignInSessionId(second)).toBe("kc-session-2");
    expect(takeSignInSessionId(first)).toBe("kc-session-1");
  });

  it.each([
    ["another provider", CALLBACK_PATH, "github"],
    [
      "the old internal callback path",
      "/oauth2/callback/:providerId",
      "custom",
    ],
    ["an email sign-in", "/sign-in/email", "custom"],
  ])("ignores %s", (_name, path, providerId) => {
    const context = {};
    const other = endpointContext(context, path, providerId);
    const callback = endpointContext(context);

    rememberSignInSessionId(idToken({ sid: "kc-session-1" }), other);
    expect(takeSignInSessionId(callback)).toBeUndefined();

    rememberSignInSessionId(idToken({ sid: "kc-session-2" }), callback);
    expect(takeSignInSessionId(other)).toBeUndefined();
    expect(takeSignInSessionId(callback)).toBe("kc-session-2");
  });

  it("ignores hooks that run outside an endpoint", () => {
    rememberSignInSessionId(idToken({ sid: "kc-session-1" }), null);
    expect(takeSignInSessionId(null)).toBeUndefined();
  });

  it.each([
    ["no ID token", undefined],
    ["a malformed ID token", "not-a-jwt"],
    ["an ID token without sid", idToken({ sub: "kc-user-1" })],
    ["an empty sid", idToken({ sid: "" })],
    ["a numeric sid", idToken({ sid: 7 })],
  ])("stores nothing for %s", (_name, token) => {
    const ctx = endpointContext();
    rememberSignInSessionId(token, ctx);
    expect(takeSignInSessionId(ctx)).toBeUndefined();
  });
});
