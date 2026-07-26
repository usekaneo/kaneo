import * as v from "valibot";

function isValidRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (["javascript:", "data:", "file:", "vbscript:"].includes(url.protocol)) {
      return false;
    }
    if (url.protocol === "http:") {
      return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    }
    return (
      url.protocol === "https:" || /^[a-z][a-z0-9+.-]*:$/.test(url.protocol)
    );
  } catch {
    return false;
  }
}

const redirectUriSchema = v.pipe(
  v.string(),
  v.maxLength(2048),
  v.check(isValidRedirectUri, "Invalid redirect URI"),
);

export const clientRegistrationSchema = v.object({
  redirect_uris: v.pipe(v.array(redirectUriSchema), v.minLength(1)),
  client_name: v.optional(v.pipe(v.string(), v.maxLength(100))),
  token_endpoint_auth_method: v.optional(v.literal("none")),
  grant_types: v.optional(v.tuple([v.literal("authorization_code")])),
  response_types: v.optional(v.tuple([v.literal("code")])),
});

export const authorizationQuerySchema = v.object({
  response_type: v.literal("code"),
  client_id: v.string(),
  redirect_uri: redirectUriSchema,
  code_challenge: v.pipe(v.string(), v.minLength(1)),
  code_challenge_method: v.literal("S256"),
  state: v.optional(v.string()),
});

export const authorizationRequestParamSchema = v.object({
  requestId: v.string(),
});

export const authorizationDecisionSchema = v.object({
  approved: v.boolean(),
});

export const oauthErrorSchema = v.object({
  error: v.string(),
});

export const clientRegistrationResponseSchema = v.object({
  client_id: v.string(),
  client_id_issued_at: v.number(),
  redirect_uris: v.array(v.string()),
  client_name: v.optional(v.string()),
  token_endpoint_auth_method: v.literal("none"),
  grant_types: v.array(v.literal("authorization_code")),
  response_types: v.array(v.literal("code")),
});

export const authorizationRequestResponseSchema = v.object({
  client_name: v.string(),
  redirect_uri: v.string(),
});

export const authorizationDecisionResponseSchema = v.object({
  redirect: v.string(),
});
