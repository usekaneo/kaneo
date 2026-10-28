import { LogoutProviderUnavailable } from "./errors";
import { fetchProviderJson } from "./fetch-provider-json";
import { isJsonObject } from "./is-json-object";
import type { JsonWebKeySet } from "./verify-logout-token";

const JWKS_REFETCH_COOLDOWN_MS = 30 * 1000;

type ProviderJwks = {
  jwksCacheKey: object;
  jwksFetch: () => Promise<JsonWebKeySet>;
};

const providerKeySources = new Map<string, ProviderJwks>();

function parseJwks(document: unknown): JsonWebKeySet {
  const keys = isJsonObject(document) ? document.keys : undefined;
  if (!Array.isArray(keys) || !keys.every(isJsonObject)) {
    throw new LogoutProviderUnavailable("the provider's key set is malformed");
  }
  return { keys: keys as JsonWebKeySet["keys"] };
}

export function providerJwks(jwksUri: string): ProviderJwks {
  const known = providerKeySources.get(jwksUri);
  if (known) return known;

  let jwks: JsonWebKeySet | undefined;
  let attemptedAt = 0;
  let pending: Promise<JsonWebKeySet> | undefined;

  const load = async () => {
    try {
      jwks = parseJwks(await fetchProviderJson(jwksUri));
      return jwks;
    } catch (error) {
      if (!jwks) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(
        `Back-channel logout kept the previous signing keys: ${reason}`,
      );
      return jwks;
    }
  };

  const source: ProviderJwks = {
    jwksCacheKey: {},
    jwksFetch: () => {
      if (pending) return pending;
      if (Date.now() - attemptedAt < JWKS_REFETCH_COOLDOWN_MS) {
        return jwks
          ? Promise.resolve(jwks)
          : Promise.reject(
              new LogoutProviderUnavailable(
                "the provider's key set failed to load moments ago",
              ),
            );
      }
      attemptedAt = Date.now();
      pending = load().finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
  providerKeySources.set(jwksUri, source);
  return source;
}
