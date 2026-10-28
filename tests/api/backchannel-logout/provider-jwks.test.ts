import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  LogoutProviderUnavailable,
  LogoutTokenRejected,
} from "../../../apps/api/src/backchannel-logout/errors";
import { providerJwks } from "../../../apps/api/src/backchannel-logout/provider-jwks";
import {
  BACKCHANNEL_LOGOUT_EVENT,
  verifyLogoutToken,
} from "../../../apps/api/src/backchannel-logout/verify-logout-token";

const ISSUER = "https://idp.example.com/realms/kaneo";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const KEYS = {
  keys: [{ ...publicKey.export({ format: "jwk" }), kid: "rsa", use: "sig" }],
};

function jwksUrl() {
  return `https://idp.example.com/${randomUUID()}/certs`;
}

function serveKeys() {
  const fetchMock = vi.fn(async () => Response.json(KEYS));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function tokenWithKeyId(kid: string) {
  const now = Math.floor(Date.now() / 1000);
  const input = `${encode({ alg: "RS256", typ: "logout+jwt", kid })}.${encode({
    iss: ISSUER,
    aud: "kaneo-test",
    iat: now,
    jti: randomUUID(),
    sub: "kc-user-1",
    events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
  })}`;
  return `${input}.${sign("sha256", Buffer.from(input), privateKey).toString("base64url")}`;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("providerJwks", () => {
  it("keeps one cache key per key set URL", () => {
    const url = jwksUrl();
    expect(providerJwks(url).jwksCacheKey).toBe(providerJwks(url).jwksCacheKey);
    expect(providerJwks(jwksUrl()).jwksCacheKey).not.toBe(
      providerJwks(url).jwksCacheKey,
    );
  });

  it("fetches the key set at most once every 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = serveKeys();
    const { jwksFetch } = providerJwks(jwksUrl());

    await expect(jwksFetch()).resolves.toEqual(KEYS);
    vi.setSystemTime(Date.now() + 29_000);
    await expect(jwksFetch()).resolves.toEqual(KEYS);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.setSystemTime(Date.now() + 1_000);
    await expect(jwksFetch()).resolves.toEqual(KEYS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares one fetch between concurrent calls", async () => {
    const fetchMock = serveKeys();
    const { jwksFetch } = providerJwks(jwksUrl());

    await Promise.all([jwksFetch(), jwksFetch(), jwksFetch()]);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps the previous key set when a later fetch fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => Response.json(KEYS))
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = jwksUrl();
    const { jwksFetch } = providerJwks(url);

    await jwksFetch();
    vi.setSystemTime(Date.now() + 30_000);

    await expect(jwksFetch()).resolves.toEqual(KEYS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      `Back-channel logout kept the previous signing keys: ${url} could not be fetched`,
    );
  });

  it("reports a missing key set as unavailable and waits before retrying", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockImplementation(async () => Response.json(KEYS));
    vi.stubGlobal("fetch", fetchMock);
    const { jwksFetch } = providerJwks(jwksUrl());

    await expect(jwksFetch()).rejects.toBeInstanceOf(LogoutProviderUnavailable);
    await expect(jwksFetch()).rejects.toBeInstanceOf(LogoutProviderUnavailable);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.setSystemTime(Date.now() + 30_000);
    await expect(jwksFetch()).resolves.toEqual(KEYS);
  });

  it.each([{}, { keys: "rsa" }, { keys: [1] }, [KEYS]])(
    "treats the malformed key set %j as unavailable",
    async (document) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json(document)),
      );
      await expect(providerJwks(jwksUrl()).jwksFetch()).rejects.toBeInstanceOf(
        LogoutProviderUnavailable,
      );
    },
  );

  it("fetches once for many tokens with unknown key IDs", async () => {
    const fetchMock = serveKeys();
    const provider = {
      issuer: ISSUER,
      algorithms: ["RS256"],
      ...providerJwks(jwksUrl()),
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(
        verifyLogoutToken(
          tokenWithKeyId(randomUUID()),
          "kaneo-test",
          async () => provider,
        ),
      ).rejects.toBeInstanceOf(LogoutTokenRejected);
    }
    await expect(
      verifyLogoutToken(
        tokenWithKeyId("rsa"),
        "kaneo-test",
        async () => provider,
      ),
    ).resolves.toEqual(expect.objectContaining({ sub: "kc-user-1" }));

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
