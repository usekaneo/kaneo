import { createHash, randomUUID } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import db from "../database";
import { sessionTable } from "../database/schema";
import {
  consumeState,
  deleteExpiredStates,
  enforceStateCap,
  getState,
  putState,
} from "./oauth-store";

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
};

export type AuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
};

// Clients re-register on invalid_client, so the TTL only bounds table growth.
const clientTtlMs = 30 * 24 * 60 * 60 * 1000;
const codeTtlMs = 5 * 60 * 1000;
const requestTtlMs = 10 * 60 * 1000;
// Same bound the in-memory store enforced; authorize is reachable without a session.
const maxAuthorizationRequests = 10_000;

export async function getClient(
  clientId: string,
): Promise<RegisteredClient | null> {
  return getState<RegisteredClient>("client", clientId);
}

export async function registerClient(params: {
  redirectUris: string[];
  clientName?: string;
}): Promise<RegisteredClient> {
  const clientId = randomUUID();
  const client: RegisteredClient = {
    clientId,
    redirectUris: [...params.redirectUris],
    clientName: params.clientName,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  await putState(
    "client",
    clientId,
    client,
    new Date(Date.now() + clientTtlMs),
  );
  return client;
}

export async function createAuthCode(params: AuthCode): Promise<string> {
  const code = randomUUID();
  await putState("code", code, params, new Date(Date.now() + codeTtlMs));
  return code;
}

export async function createAuthorizationRequest(
  params: AuthorizationRequest,
): Promise<string> {
  await deleteExpiredStates();
  await enforceStateCap("request", maxAuthorizationRequests);
  const requestId = randomUUID();
  await putState(
    "request",
    requestId,
    params,
    new Date(Date.now() + requestTtlMs),
  );
  return requestId;
}

export async function getAuthorizationRequest(
  requestId: string,
): Promise<AuthorizationRequest | null> {
  return getState<AuthorizationRequest>("request", requestId);
}

export async function consumeAuthorizationRequest(
  requestId: string,
): Promise<AuthorizationRequest | null> {
  return consumeState<AuthorizationRequest>("request", requestId);
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
  const stored = await consumeState<AuthCode>("code", code);
  if (!stored) return null;

  if (stored.clientId !== clientId) return null;
  if (stored.redirectUri !== redirectUri) return null;
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
