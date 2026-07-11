import { HTTPException } from "hono/http-exception";
import { auth } from "../../auth";
import { publishEvent } from "../../events";
import {
  createAuthCode,
  createAuthorizationContext,
  getClient,
  verifyAuthorizationContext,
} from "../oauth";

type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
};

type DeviceAuthorization = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
};

async function issueAuthorizationCode(params: {
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
}) {
  const code = createAuthCode(params);
  await publishEvent("mcp.authorization_code_issued", {
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
  });
  return code;
}

function buildClientRedirect(
  redirectUri: string,
  code: string,
  state?: string,
) {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state !== undefined) url.searchParams.set("state", state);
  return url.toString();
}

export async function authorizeClient(
  request: AuthorizationRequest,
  headers: Headers,
  apiUrl: string,
) {
  const client = getClient(request.clientId);
  if (!client) {
    throw new HTTPException(400, { message: "invalid_client" });
  }
  if (!client.redirectUris.includes(request.redirectUri)) {
    throw new HTTPException(400, { message: "invalid_redirect_uri" });
  }

  const session = await auth.api.getSession({ headers });
  if (session?.user?.id) {
    const code = await issueAuthorizationCode({
      clientId: request.clientId,
      userId: session.user.id,
      codeChallenge: request.codeChallenge,
      redirectUri: request.redirectUri,
    });
    return {
      type: "redirect" as const,
      redirect: buildClientRedirect(request.redirectUri, code, request.state),
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/auth/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "kaneo-mcp" }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new HTTPException(504, { message: "device_code_timeout" });
    }
    throw error;
  }

  if (!response.ok) {
    throw new HTTPException(502, { message: "device_code_failed" });
  }

  const device = (await response.json()) as DeviceAuthorization;
  const authorizationContext = createAuthorizationContext({
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    ...(request.state !== undefined ? { state: request.state } : {}),
  });

  return { type: "device" as const, device, authorizationContext };
}

export async function completeClientAuthorization(
  accessToken: string,
  authorizationContext: string,
) {
  const context = verifyAuthorizationContext(authorizationContext);
  if (!context) {
    throw new HTTPException(400, { message: "invalid_request" });
  }

  const headers = new Headers({ authorization: `Bearer ${accessToken}` });
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) {
    throw new HTTPException(401, { message: "invalid_token" });
  }

  const code = await issueAuthorizationCode({
    clientId: context.clientId,
    userId: session.user.id,
    codeChallenge: context.codeChallenge,
    redirectUri: context.redirectUri,
  });
  return buildClientRedirect(context.redirectUri, code, context.state);
}
