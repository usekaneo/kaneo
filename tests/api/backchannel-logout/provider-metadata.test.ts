import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { LogoutProviderUnavailable } from "../../../apps/api/src/backchannel-logout/errors";
import { MAX_PROVIDER_DOCUMENT_BYTES } from "../../../apps/api/src/backchannel-logout/fetch-provider-json";
import {
  getProviderMetadata,
  parseProviderMetadata,
} from "../../../apps/api/src/backchannel-logout/provider-metadata";
import { ASYMMETRIC_ALGORITHMS } from "../../../apps/api/src/backchannel-logout/verify-logout-token";

const ISSUER = "https://idp.example.com/realms/kaneo";
const JWKS_URI = `${ISSUER}/protocol/openid-connect/certs`;
const DOCUMENT = {
  issuer: ISSUER,
  jwks_uri: JWKS_URI,
  id_token_signing_alg_values_supported: ["RS256", "HS256", "ES256", "Ed448"],
};

function discoveryUrl() {
  return `https://idp.example.com/${randomUUID()}/.well-known/openid-configuration`;
}

function serveDocument() {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json(DOCUMENT),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseProviderMetadata", () => {
  it("keeps the asymmetric ID token algorithms the provider offers", () => {
    expect(parseProviderMetadata(DOCUMENT)).toEqual({
      issuer: ISSUER,
      jwksUri: JWKS_URI,
      algorithms: ["RS256", "ES256"],
    });
  });

  it("allows every asymmetric algorithm when the provider lists none", () => {
    expect(
      parseProviderMetadata({ issuer: ISSUER, jwks_uri: JWKS_URI }).algorithms,
    ).toEqual(ASYMMETRIC_ALGORITHMS);
  });

  it.each([
    ["no issuer", { jwks_uri: JWKS_URI }],
    ["an empty issuer", { issuer: "", jwks_uri: JWKS_URI }],
    ["no jwks_uri", { issuer: ISSUER }],
    ["a relative jwks_uri", { issuer: ISSUER, jwks_uri: "/certs" }],
    [
      "only symmetric algorithms",
      {
        issuer: ISSUER,
        jwks_uri: JWKS_URI,
        id_token_signing_alg_values_supported: ["HS256"],
      },
    ],
    ["a list instead of an object", [ISSUER]],
  ])("treats a document with %s as unavailable", (_name, document) => {
    expect(() => parseProviderMetadata(document)).toThrow(
      LogoutProviderUnavailable,
    );
  });
});

describe("getProviderMetadata", () => {
  it("asks for JSON, refuses redirects and sets a timeout", async () => {
    const fetchMock = serveDocument();
    const url = discoveryUrl();

    await getProviderMetadata(url);

    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("caches the document and shares one fetch between concurrent calls", async () => {
    const fetchMock = serveDocument();
    const url = discoveryUrl();

    const [first, second] = await Promise.all([
      getProviderMetadata(url),
      getProviderMetadata(url),
    ]);

    expect(second).toEqual(first);
    await expect(getProviderMetadata(url)).resolves.toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["an error status", () => new Response("down", { status: 500 })],
    ["invalid JSON", () => new Response("not json")],
    [
      "a body over the size limit",
      () => new Response("x".repeat(MAX_PROVIDER_DOCUMENT_BYTES + 1)),
    ],
  ])("treats %s as unavailable", async (_name, respond) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond()),
    );
    await expect(getProviderMetadata(discoveryUrl())).rejects.toBeInstanceOf(
      LogoutProviderUnavailable,
    );
  });

  it("waits 30 seconds before it retries a failed fetch", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockImplementation(async () => Response.json(DOCUMENT));
    vi.stubGlobal("fetch", fetchMock);
    const url = discoveryUrl();

    await expect(getProviderMetadata(url)).rejects.toBeInstanceOf(
      LogoutProviderUnavailable,
    );
    vi.setSystemTime(Date.now() + 29_000);
    await expect(getProviderMetadata(url)).rejects.toBeInstanceOf(
      LogoutProviderUnavailable,
    );
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.setSystemTime(Date.now() + 1_000);
    await expect(getProviderMetadata(url)).resolves.toEqual(
      expect.objectContaining({ issuer: ISSUER }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes after an hour and keeps the cached document if that fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => Response.json(DOCUMENT))
      .mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    const url = discoveryUrl();
    const cached = await getProviderMetadata(url);

    vi.setSystemTime(Date.now() + 59 * 60 * 1000);
    await expect(getProviderMetadata(url)).resolves.toEqual(cached);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.setSystemTime(Date.now() + 60 * 1000);
    await expect(getProviderMetadata(url)).resolves.toEqual(cached);
    await expect(getProviderMetadata(url)).resolves.toEqual(cached);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
