import { z } from "../openapi";

// Redirect URIs are attacker-supplied during dynamic client registration, so
// anything that could turn into script execution or credential leakage is
// rejected: fragments, embedded credentials, and script-bearing schemes.
// Plain http is allowed only for loopback, per OAuth 2.1 for native apps.
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

const redirectUriSchema = z
  .string()
  .max(2048)
  .refine(isValidRedirectUri, "Invalid redirect URI");

// Clients such as Claude also ask for refresh_token. The server never issues
// one, so the grant is accepted here and omitted from the registration response.
export const clientRegistrationSchema = z.object({
  redirect_uris: z.array(redirectUriSchema).min(1),
  client_name: z.string().max(100).optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .refine(
      (types) => types.includes("authorization_code"),
      "grant_types must include authorization_code",
    )
    .optional(),
  response_types: z.array(z.literal("code")).min(1).optional(),
});

export const authorizationQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: redirectUriSchema,
  code_challenge: z.string().min(1).openapi({
    description: "PKCE challenge; only S256 is accepted.",
  }),
  code_challenge_method: z.literal("S256"),
  state: z.string().optional(),
});

export const authorizationRequestParamSchema = z.object({
  requestId: z.string(),
});

export const authorizationDecisionSchema = z.object({
  approved: z.boolean(),
});

export const oauthErrorSchema = z
  .object({ error: z.string(), error_description: z.string().optional() })
  .openapi("OAuthError");

export const clientRegistrationResponseSchema = z
  .object({
    client_id: z.string(),
    client_id_issued_at: z.number(),
    redirect_uris: z.array(z.string()),
    client_name: z.string().optional(),
    token_endpoint_auth_method: z.literal("none"),
    grant_types: z.array(z.literal("authorization_code")),
    response_types: z.array(z.literal("code")),
  })
  .openapi("McpClientRegistration");

export const authorizationRequestResponseSchema = z
  .object({ client_name: z.string(), redirect_uri: z.string() })
  .openapi("McpAuthorizationRequest");

export const authorizationDecisionResponseSchema = z
  .object({
    redirect: z.string().openapi({
      description:
        "Where to send the browser next: back to the client with a code on approval, or with an error on denial.",
    }),
  })
  .openapi("McpAuthorizationDecision");
