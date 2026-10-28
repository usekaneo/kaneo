import { isHttpUrl } from "../utils/is-http-url";
import { LogoutProviderUnavailable } from "./errors";
import { fetchProviderJson } from "./fetch-provider-json";
import { isJsonObject } from "./is-json-object";
import { ASYMMETRIC_ALGORITHMS } from "./verify-logout-token";

const METADATA_TTL_MS = 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 30 * 1000;

export type ProviderMetadata = {
  issuer: string;
  jwksUri: string;
  algorithms: string[];
};

type CachedMetadata = {
  metadata?: ProviderMetadata;
  fetchedAt: number;
  failedAt?: number;
  pending?: Promise<ProviderMetadata>;
};

const cachedMetadata = new Map<string, CachedMetadata>();

export function parseProviderMetadata(document: unknown): ProviderMetadata {
  const fields: Record<string, unknown> = isJsonObject(document)
    ? document
    : {};
  const {
    issuer,
    jwks_uri: jwksUri,
    id_token_signing_alg_values_supported: offered,
  } = fields;
  if (typeof issuer !== "string" || !issuer) {
    throw new LogoutProviderUnavailable("the discovery document has no issuer");
  }
  if (typeof jwksUri !== "string" || !isHttpUrl(jwksUri)) {
    throw new LogoutProviderUnavailable(
      "the discovery document has no absolute jwks_uri",
    );
  }
  const algorithms = Array.isArray(offered)
    ? ASYMMETRIC_ALGORITHMS.filter((algorithm) => offered.includes(algorithm))
    : ASYMMETRIC_ALGORITHMS;
  if (algorithms.length === 0) {
    throw new LogoutProviderUnavailable(
      "the provider offers no asymmetric ID token signing algorithm",
    );
  }
  return { issuer, jwksUri, algorithms };
}

export function getProviderMetadata(
  discoveryUrl: string,
): Promise<ProviderMetadata> {
  const cached = cachedMetadata.get(discoveryUrl);
  if (cached?.pending) return cached.pending;
  const now = Date.now();
  if (cached?.metadata && now - cached.fetchedAt < METADATA_TTL_MS) {
    return Promise.resolve(cached.metadata);
  }
  if (
    cached?.failedAt !== undefined &&
    now - cached.failedAt < RETRY_AFTER_FAILURE_MS
  ) {
    return cached.metadata
      ? Promise.resolve(cached.metadata)
      : Promise.reject(
          new LogoutProviderUnavailable(
            "the discovery document failed to load moments ago",
          ),
        );
  }

  const pending = fetchProviderJson(discoveryUrl)
    .then(parseProviderMetadata)
    .then(
      (metadata) => {
        cachedMetadata.set(discoveryUrl, { metadata, fetchedAt: Date.now() });
        return metadata;
      },
      (error: unknown) => {
        cachedMetadata.set(discoveryUrl, {
          metadata: cached?.metadata,
          fetchedAt: cached?.fetchedAt ?? 0,
          failedAt: Date.now(),
        });
        if (cached?.metadata) return cached.metadata;
        throw error;
      },
    );
  cachedMetadata.set(discoveryUrl, {
    ...cached,
    fetchedAt: cached?.fetchedAt ?? 0,
    pending,
  });
  return pending;
}
