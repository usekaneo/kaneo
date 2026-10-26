import { verifyJwsAccessToken } from "better-auth/oauth2";
import { decodeJwtSegment } from "./decode-jwt-segment";
import { LogoutProviderUnavailable, LogoutTokenRejected } from "./errors";
import { isJsonObject } from "./is-json-object";

type VerifyJwsOptions = Parameters<typeof verifyJwsAccessToken>[1];

export type JsonWebKeySet = NonNullable<
  Awaited<ReturnType<Exclude<VerifyJwsOptions["jwksFetch"], string>>>
>;

export const ASYMMETRIC_ALGORITHMS = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
];

export const BACKCHANNEL_LOGOUT_EVENT =
  "http://schemas.openid.net/event/backchannel-logout";
export const MAX_LOGOUT_TOKEN_AGE_SECONDS = 10 * 60;
export const CLOCK_SKEW_SECONDS = 60;

export type LogoutTokenProvider = {
  issuer: string;
  algorithms: string[];
  jwksFetch: () => Promise<JsonWebKeySet>;
  jwksCacheKey: object;
};

export type LogoutTokenClaims = {
  iss: string;
  jti: string;
  iat: number;
  sid?: string;
  sub?: string;
};

function isLogoutTokenType(type: unknown) {
  if (typeof type !== "string") return false;
  const normalized = type.toLowerCase().replace(/^application\//, "");
  return normalized === "logout+jwt" || normalized === "jwt";
}

function readIdentifier(value: unknown, claim: "sid" | "sub") {
  if (value === undefined) return undefined;
  if (typeof value === "string" && value) return value;
  throw new LogoutTokenRejected(`${claim} must be a non-empty string`);
}

export async function verifyLogoutToken(
  token: string,
  clientId: string,
  loadProvider: () => Promise<LogoutTokenProvider>,
): Promise<LogoutTokenClaims> {
  const header = decodeJwtSegment(token, 0);
  if (!header) throw new LogoutTokenRejected("the header is not a JSON object");
  const { alg, typ, crit } = header;
  if (typeof alg !== "string" || !ASYMMETRIC_ALGORITHMS.includes(alg)) {
    throw new LogoutTokenRejected("the signing algorithm is not supported");
  }
  if (typ !== undefined && !isLogoutTokenType(typ)) {
    throw new LogoutTokenRejected("the token type is not logout+jwt or JWT");
  }
  if (crit !== undefined) {
    throw new LogoutTokenRejected(
      "critical header parameters are not supported",
    );
  }

  const provider = await loadProvider();
  if (!provider.algorithms.includes(alg)) {
    throw new LogoutTokenRejected(
      "the provider does not sign ID tokens with this algorithm",
    );
  }

  let payload: Awaited<ReturnType<typeof verifyJwsAccessToken>>;
  try {
    payload = await verifyJwsAccessToken(token, {
      jwksFetch: provider.jwksFetch,
      jwksCacheKey: provider.jwksCacheKey,
      verifyOptions: {
        issuer: provider.issuer,
        audience: clientId,
        algorithms: provider.algorithms,
        requiredClaims: ["iat", "jti", "events"],
        clockTolerance: CLOCK_SKEW_SECONDS,
      },
    });
  } catch (error) {
    if (error instanceof LogoutProviderUnavailable) throw error;
    throw new LogoutTokenRejected(
      error instanceof Error ? error.message : "the token is invalid",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const { iat, jti, events } = payload;
  if (
    typeof iat !== "number" ||
    iat > now + CLOCK_SKEW_SECONDS ||
    iat < now - MAX_LOGOUT_TOKEN_AGE_SECONDS
  ) {
    throw new LogoutTokenRejected("iat is outside the accepted window");
  }
  if (typeof jti !== "string" || !jti) {
    throw new LogoutTokenRejected("jti must be a non-empty string");
  }
  if (
    !isJsonObject(events) ||
    !isJsonObject(events[BACKCHANNEL_LOGOUT_EVENT])
  ) {
    throw new LogoutTokenRejected("the back-channel logout event is missing");
  }
  if (Object.hasOwn(payload, "nonce")) {
    throw new LogoutTokenRejected("a logout token must not contain a nonce");
  }
  const sid = readIdentifier(payload.sid, "sid");
  const sub = readIdentifier(payload.sub, "sub");
  if (!sid && !sub) throw new LogoutTokenRejected("sid or sub is required");

  return { iss: provider.issuer, jti, iat, sid, sub };
}
