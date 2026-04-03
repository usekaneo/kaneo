import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import { verifyApiKey } from "./verify-api-key";

async function getSessionFromBearerOnlyHeaders(c: Context) {
  const headers = new Headers(c.req.raw.headers);
  headers.delete("cookie");

  return auth.api.getSession({ headers });
}

function parseBearerToken(authHeader: string | undefined): {
  token: string | null;
  malformed: boolean;
} {
  if (!authHeader) {
    return { token: null, malformed: false };
  }

  if (!authHeader.match(/^Bearer\b/i)) {
    return { token: null, malformed: false };
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return { token: null, malformed: true };
  }

  return {
    token: match[1],
    malformed: false,
  };
}

export async function authenticateApiRequest(c: Context): Promise<void> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (token) {
    const apiKeyResult = await verifyApiKey(token);
    if (apiKeyResult?.valid && apiKeyResult.key) {
      const key = apiKeyResult.key;
      c.set("userId", key.userId);
      c.set("userEmail", "");
      c.set("user", null);
      c.set("session", null);
      c.set("apiKey", {
        id: key.id,
        userId: key.userId,
        enabled: key.enabled,
      });
      return;
    }
    const sessionResult = await getSessionFromBearerOnlyHeaders(c);
    if (sessionResult?.user && sessionResult.session) {
      c.set("user", sessionResult.user);
      c.set("session", sessionResult.session);
      c.set("userId", sessionResult.user.id);
      c.set("userEmail", sessionResult.user.email ?? "");
      return;
    }
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  c.set("user", sessionResult?.user ?? null);
  c.set("session", sessionResult?.session ?? null);
  c.set("userId", sessionResult?.user?.id ?? "");
  c.set("userEmail", sessionResult?.user?.email ?? "");

  if (!sessionResult?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
}

export async function resolveAssetBearerOrCookie(c: Context): Promise<{
  userId: string;
  apiKeyId?: string;
}> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (token) {
    const apiKeyResult = await verifyApiKey(token);
    if (apiKeyResult?.valid && apiKeyResult.key) {
      return {
        userId: apiKeyResult.key.userId,
        apiKeyId: apiKeyResult.key.id,
      };
    }
    const sessionResult = await getSessionFromBearerOnlyHeaders(c);
    if (sessionResult?.user?.id) {
      return { userId: sessionResult.user.id };
    }
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!sessionResult?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return { userId: sessionResult.user.id };
}
