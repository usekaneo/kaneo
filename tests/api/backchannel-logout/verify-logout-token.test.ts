import {
  constants,
  generateKeyPairSync,
  type KeyObject,
  randomUUID,
  sign,
} from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  LogoutProviderUnavailable,
  LogoutTokenRejected,
} from "../../../apps/api/src/backchannel-logout/errors";
import {
  ASYMMETRIC_ALGORITHMS,
  BACKCHANNEL_LOGOUT_EVENT,
  type LogoutTokenProvider,
  verifyLogoutToken,
} from "../../../apps/api/src/backchannel-logout/verify-logout-token";

const ISSUER = "https://idp.example.com/realms/kaneo";
const CLIENT_ID = "kaneo-test";
const NOW = Math.floor(Date.parse("2026-10-18T12:00:00Z") / 1000);

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherRsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
const ed = generateKeyPairSync("ed25519");

const JWKS = {
  keys: [
    { ...rsa.publicKey.export({ format: "jwk" }), kid: "rsa", use: "sig" },
    { ...ec.publicKey.export({ format: "jwk" }), kid: "ec", use: "sig" },
    { ...ed.publicKey.export({ format: "jwk" }), kid: "ed", use: "sig" },
  ],
};

const signers: Record<
  string,
  { kid: string; sign: (data: Buffer, key?: KeyObject) => Buffer }
> = {
  RS256: {
    kid: "rsa",
    sign: (data, key = rsa.privateKey) => sign("sha256", data, key),
  },
  PS256: {
    kid: "rsa",
    sign: (data) =>
      sign("sha256", data, {
        key: rsa.privateKey,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      }),
  },
  ES256: {
    kid: "ec",
    sign: (data) =>
      sign("sha256", data, { key: ec.privateKey, dsaEncoding: "ieee-p1363" }),
  },
  EdDSA: { kid: "ed", sign: (data) => sign(null, data, ed.privateKey) },
};

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function logoutClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: ISSUER,
    aud: CLIENT_ID,
    iat: NOW,
    exp: NOW + 120,
    jti: "logout-1",
    sub: "kc-user-1",
    sid: "kc-session-1",
    events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
    ...overrides,
  };
}

function signToken(
  claims: unknown = logoutClaims(),
  header: Record<string, unknown> = {},
  key?: KeyObject,
) {
  const alg = typeof header.alg === "string" ? header.alg : "RS256";
  const signer = signers[alg] ?? signers.RS256;
  if (!signer) throw new Error("Missing RS256 signer");
  const input = `${encode({ alg, typ: "logout+jwt", kid: signer.kid, ...header })}.${encode(claims)}`;
  return `${input}.${signer.sign(Buffer.from(input), key).toString("base64url")}`;
}

function providerWith(overrides: Partial<LogoutTokenProvider> = {}) {
  const provider: LogoutTokenProvider = {
    issuer: ISSUER,
    algorithms: ASYMMETRIC_ALGORITHMS,
    jwksFetch: async () => JWKS,
    jwksCacheKey: {},
    ...overrides,
  };
  return vi.fn(async () => provider);
}

function verify(token: string, loadProvider = providerWith()) {
  return verifyLogoutToken(token, CLIENT_ID, loadProvider);
}

async function expectRejected(token: string, loadProvider = providerWith()) {
  await expect(verify(token, loadProvider)).rejects.toBeInstanceOf(
    LogoutTokenRejected,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyLogoutToken", () => {
  it("returns the claims of a valid logout token", async () => {
    await expect(verify(signToken())).resolves.toEqual({
      iss: ISSUER,
      jti: "logout-1",
      iat: NOW,
      sid: "kc-session-1",
      sub: "kc-user-1",
    });
  });

  it.each(["PS256", "ES256", "EdDSA"])("accepts %s signatures", async (alg) => {
    await expect(verify(signToken(logoutClaims(), { alg }))).resolves.toEqual(
      expect.objectContaining({ jti: "logout-1" }),
    );
  });

  it.each(["logout+jwt", "JWT", "application/logout+jwt", undefined])(
    "accepts the token type %p",
    async (typ) => {
      await expect(verify(signToken(logoutClaims(), { typ }))).resolves.toEqual(
        expect.objectContaining({ jti: "logout-1" }),
      );
    },
  );

  it("accepts an audience list that contains the client ID", async () => {
    await expect(
      verify(signToken(logoutClaims({ aud: ["other-client", CLIENT_ID] }))),
    ).resolves.toEqual(expect.objectContaining({ jti: "logout-1" }));
  });

  it("accepts a token with only a session ID or only a subject", async () => {
    await expect(
      verify(signToken(logoutClaims({ sub: undefined }))),
    ).resolves.toEqual(
      expect.objectContaining({ sid: "kc-session-1", sub: undefined }),
    );
    await expect(
      verify(signToken(logoutClaims({ sid: undefined }))),
    ).resolves.toEqual(
      expect.objectContaining({ sid: undefined, sub: "kc-user-1" }),
    );
  });

  it.each([
    [
      "a header that is not JSON",
      `${Buffer.from("not-json").toString("base64url")}.e30.c2ln`,
    ],
    ["a header that is a JSON array", `${encode(["RS256"])}.e30.c2ln`],
    ["alg none", `${encode({ alg: "none" })}.${encode(logoutClaims())}.c2ln`],
    [
      "HS256",
      `${encode({ alg: "HS256", kid: "rsa" })}.${encode(logoutClaims())}.c2ln`,
    ],
    [
      "ES256K",
      `${encode({ alg: "ES256K", kid: "ec" })}.${encode(logoutClaims())}.c2ln`,
    ],
    ["a critical header", signToken(logoutClaims(), { crit: ["exp"], exp: 1 })],
    ["typ at+jwt", signToken(logoutClaims(), { typ: "at+jwt" })],
    ["typ secevent+jwt", signToken(logoutClaims(), { typ: "secevent+jwt" })],
    ["a numeric typ", signToken(logoutClaims(), { typ: 1 })],
  ])("rejects %s before loading the provider", async (_name, token) => {
    const loadProvider = providerWith();
    await expectRejected(token, loadProvider);
    expect(loadProvider).not.toHaveBeenCalled();
  });

  it("rejects an algorithm the provider does not sign ID tokens with", async () => {
    await expectRejected(signToken(), providerWith({ algorithms: ["ES256"] }));
  });

  it("rejects a payload that is not a JSON object", async () => {
    await expectRejected(signToken([logoutClaims()]));
  });

  it("rejects a token signed by another key", async () => {
    await expectRejected(signToken(logoutClaims(), {}, otherRsa.privateKey));
    await expectRejected(signToken(logoutClaims(), { kid: "unknown" }));
  });

  it.each([
    ["another issuer", { iss: "https://idp.example.com/realms/other" }],
    ["no issuer", { iss: undefined }],
    ["another audience", { aud: "other-client" }],
    ["no audience", { aud: undefined }],
    ["no iat", { iat: undefined }],
    ["a string iat", { iat: String(NOW) }],
    ["an iat over a minute ahead", { iat: NOW + 61 }],
    ["an iat over ten minutes old", { iat: NOW - 601 }],
    ["an exp over a minute ago", { exp: NOW - 61 }],
    ["no jti", { jti: undefined }],
    ["an empty jti", { jti: "" }],
    ["a numeric jti", { jti: 42 }],
    ["no events", { events: undefined }],
    ["events as a list", { events: [BACKCHANNEL_LOGOUT_EVENT] }],
    ["events without the logout event", { events: { other: {} } }],
    [
      "a logout event set to true",
      { events: { [BACKCHANNEL_LOGOUT_EVENT]: true } },
    ],
    [
      "a logout event set to a list",
      { events: { [BACKCHANNEL_LOGOUT_EVENT]: [] } },
    ],
    [
      "a logout event set to null",
      { events: { [BACKCHANNEL_LOGOUT_EVENT]: null } },
    ],
    [
      "a logout event set to text",
      { events: { [BACKCHANNEL_LOGOUT_EVENT]: "x" } },
    ],
    ["neither sid nor sub", { sid: undefined, sub: undefined }],
    ["an empty sub", { sub: "" }],
    ["a numeric sid", { sid: 7 }],
    ["a nonce", { nonce: "n-1" }],
  ])("rejects a token with %s", async (_name, overrides) => {
    await expectRejected(signToken(logoutClaims(overrides)));
  });

  it.each([
    ["an iat a minute ahead", { iat: NOW + 60 }],
    ["an iat ten minutes old", { iat: NOW - 600, exp: NOW + 60 }],
    ["an exp less than a minute ago", { exp: NOW - 59 }],
    ["no exp", { exp: undefined }],
  ])("accepts a token with %s", async (_name, overrides) => {
    await expect(verify(signToken(logoutClaims(overrides)))).resolves.toEqual(
      expect.objectContaining({ jti: "logout-1" }),
    );
  });

  it("reports an unreachable provider as unavailable", async () => {
    await expect(
      verify(
        signToken(),
        vi.fn(async () => {
          throw new LogoutProviderUnavailable("down");
        }),
      ),
    ).rejects.toBeInstanceOf(LogoutProviderUnavailable);
    await expect(
      verify(
        signToken(),
        providerWith({
          jwksFetch: async () => {
            throw new LogoutProviderUnavailable("down");
          },
        }),
      ),
    ).rejects.toBeInstanceOf(LogoutProviderUnavailable);
  });

  it("never puts the token or its claims into the rejection message", async () => {
    const jti = randomUUID();
    const token = signToken(logoutClaims({ jti, aud: "other-client" }));
    const error = await verify(token).catch((rejection: unknown) => rejection);
    expect(error).toBeInstanceOf(LogoutTokenRejected);
    expect(String(error)).not.toContain(jti);
    expect(String(error)).not.toContain(token);
  });
});
