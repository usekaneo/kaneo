import { createHash, randomUUID } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import db from "../database";
import { sessionTable } from "../database/schema";

type RegisteredClient = {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  issuedAt: number;
};

type AuthCode = {
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  expiresAt: number;
};

export type AuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
  expiresAt: number;
};

const clients = new Map<string, RegisteredClient>();
const codes = new Map<string, AuthCode>();
const authorizationRequests = new Map<string, AuthorizationRequest>();
const maxAuthorizationRequests = 10_000;

function pruneAuthorizationRequests(now = Date.now()): void {
  for (const [requestId, request] of authorizationRequests) {
    if (request.expiresAt < now) authorizationRequests.delete(requestId);
  }

  while (authorizationRequests.size >= maxAuthorizationRequests) {
    const oldestRequestId = authorizationRequests.keys().next().value;
    if (!oldestRequestId) break;
    authorizationRequests.delete(oldestRequestId);
  }
}

export function getClient(clientId: string): RegisteredClient | undefined {
  return clients.get(clientId);
}

export function registerClient(params: {
  redirectUris: string[];
  clientName?: string;
}): RegisteredClient {
  const clientId = randomUUID();
  const client: RegisteredClient = {
    clientId,
    redirectUris: params.redirectUris,
    clientName: params.clientName,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  clients.set(clientId, client);
  return client;
}

export function createAuthCode(params: {
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const code = randomUUID();
  codes.set(code, {
    ...params,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return code;
}

export function createAuthorizationRequest(params: {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
}): string {
  pruneAuthorizationRequests();
  const requestId = randomUUID();
  authorizationRequests.set(requestId, {
    ...params,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return requestId;
}

export function getAuthorizationRequest(
  requestId: string,
): AuthorizationRequest | undefined {
  const request = authorizationRequests.get(requestId);
  if (!request) return undefined;
  if (request.expiresAt < Date.now()) {
    authorizationRequests.delete(requestId);
    return undefined;
  }
  return request;
}

export function consumeAuthorizationRequest(
  requestId: string,
): AuthorizationRequest | undefined {
  const request = getAuthorizationRequest(requestId);
  if (!request) return undefined;
  authorizationRequests.delete(requestId);
  return request;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash("sha256").update(codeVerifier).digest();
  return base64url(hash) === codeChallenge;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const stored = codes.get(code);
  if (!stored) return null;
  codes.delete(code);

  if (stored.clientId !== clientId) return null;
  if (stored.redirectUri !== redirectUri) return null;
  if (stored.expiresAt < Date.now()) return null;
  if (!verifyPkce(codeVerifier, stored.codeChallenge)) return null;

  const sessionToken = randomUUID();
  const expiresIn = 30 * 24 * 60 * 60;

  await db.insert(sessionTable).values({
    id: createId(),
    token: sessionToken,
    userId: stored.userId,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { accessToken: sessionToken, expiresIn };
}
