import { HTTPException } from "hono/http-exception";
import type * as v from "valibot";
import { auth } from "../../auth";
import { publishEvent } from "../../events";
import {
  consumeAuthorizationRequest,
  createAuthCode,
  createAuthorizationRequest,
  getAuthorizationRequest,
  getClient,
  registerClient,
} from "../oauth";
import type {
  authorizationDecisionSchema,
  authorizationQuerySchema,
  clientRegistrationSchema,
} from "../schemas";

const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";

type ClientRegistrationInput = v.InferOutput<typeof clientRegistrationSchema>;
type AuthorizationInput = v.InferOutput<typeof authorizationQuerySchema>;
type AuthorizationDecisionInput = v.InferOutput<
  typeof authorizationDecisionSchema
>;

type OAuthErrorStatus = 400 | 401 | 403 | 404;

function throwOAuthError(status: OAuthErrorStatus, error: string): never {
  throw new HTTPException(status, {
    res: Response.json({ error }, { status }),
  });
}

function buildAuthorizationRedirect(
  request: { redirectUri: string; state?: string },
  params: Record<string, string>,
): string {
  const url = new URL(request.redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (request.state !== undefined) {
    url.searchParams.set("state", request.state);
  }
  return url.toString();
}

function isTrustedConsentOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(clientUrl).origin;
  } catch {
    return false;
  }
}

export function registerMcpClient(input: ClientRegistrationInput) {
  const client = registerClient({
    redirectUris: input.redirect_uris,
    clientName: input.client_name,
  });

  return {
    client_id: client.clientId,
    client_id_issued_at: client.issuedAt,
    redirect_uris: client.redirectUris,
    client_name: client.clientName,
    token_endpoint_auth_method: input.token_endpoint_auth_method ?? "none",
    grant_types: input.grant_types ?? ["authorization_code"],
    response_types: input.response_types ?? ["code"],
  } as const;
}

export function beginMcpAuthorization(input: AuthorizationInput): string {
  const client = getClient(input.client_id);
  if (!client) throwOAuthError(400, "invalid_client");
  if (!client.redirectUris.includes(input.redirect_uri)) {
    throwOAuthError(400, "invalid_redirect_uri");
  }

  const requestId = createAuthorizationRequest({
    clientId: input.client_id,
    codeChallenge: input.code_challenge,
    redirectUri: input.redirect_uri,
    state: input.state,
  });
  const consentUrl = new URL("/mcp/authorize", clientUrl);
  consentUrl.searchParams.set("request_id", requestId);
  return consentUrl.toString();
}

export function getMcpAuthorizationRequest(requestId: string) {
  const request = getAuthorizationRequest(requestId);
  if (!request) throwOAuthError(404, "invalid_or_expired_request");

  const client = getClient(request.clientId);
  if (!client) throwOAuthError(400, "invalid_client");

  return {
    client_name: client.clientName ?? "MCP client",
    redirect_uri: request.redirectUri,
  };
}

export async function decideMcpAuthorizationRequest(params: {
  requestId: string;
  decision: AuthorizationDecisionInput;
  headers: Headers;
  origin?: string;
}): Promise<string> {
  if (!isTrustedConsentOrigin(params.origin)) {
    throwOAuthError(403, "invalid_origin");
  }

  const session = await auth.api.getSession({ headers: params.headers });
  if (!session?.user?.id) throwOAuthError(401, "unauthorized");

  const request = consumeAuthorizationRequest(params.requestId);
  if (!request) throwOAuthError(404, "invalid_or_expired_request");

  const client = getClient(request.clientId);
  if (!client || !client.redirectUris.includes(request.redirectUri)) {
    throwOAuthError(400, "invalid_client");
  }

  if (!params.decision.approved) {
    return buildAuthorizationRedirect(request, { error: "access_denied" });
  }

  const code = createAuthCode({
    clientId: request.clientId,
    userId: session.user.id,
    codeChallenge: request.codeChallenge,
    redirectUri: request.redirectUri,
  });
  await publishEvent("mcp.authorization_code_issued", {
    clientId: request.clientId,
    userId: session.user.id,
    redirectUri: request.redirectUri,
  });
  return buildAuthorizationRedirect(request, { code });
}
