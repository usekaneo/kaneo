import { createHash, randomUUID } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import db from "../database";
import {
  mcpOAuthAuthorizationRequestTable,
  mcpOAuthClientTable,
  mcpOAuthCodeTable,
  sessionTable,
} from "../database/schema";

type RegisteredClient = {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  issuedAt: number;
};

export type AuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
  expiresAt: number;
};

const maxAuthorizationRequests = 10_000;

export async function getClient(
  clientId: string,
): Promise<RegisteredClient | undefined> {
  const [client] = await db
    .select()
    .from(mcpOAuthClientTable)
    .where(eq(mcpOAuthClientTable.id, clientId))
    .limit(1);
  if (!client) return undefined;
  return {
    clientId: client.id,
    redirectUris: client.redirectUris,
    clientName: client.name ?? undefined,
    issuedAt: Math.floor(client.issuedAt.getTime() / 1000),
  };
}

export async function registerClient(params: {
  redirectUris: string[];
  clientName?: string;
}): Promise<RegisteredClient> {
  const clientId = randomUUID();
  const issuedAt = new Date();
  const client: RegisteredClient = {
    clientId,
    redirectUris: [...params.redirectUris],
    clientName: params.clientName,
    issuedAt: Math.floor(issuedAt.getTime() / 1000),
  };
  await db.insert(mcpOAuthClientTable).values({
    id: clientId,
    redirectUris: client.redirectUris,
    name: client.clientName,
    issuedAt,
  });
  return client;
}

export async function createAuthCode(params: {
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
}): Promise<string> {
  const code = randomUUID();
  await db
    .delete(mcpOAuthCodeTable)
    .where(lt(mcpOAuthCodeTable.expiresAt, new Date()));
  await db.insert(mcpOAuthCodeTable).values({
    id: code,
    ...params,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  return code;
}

export async function createAuthorizationRequest(params: {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
}): Promise<string> {
  const requestId = randomUUID();
  const now = new Date();
  await db
    .delete(mcpOAuthAuthorizationRequestTable)
    .where(lt(mcpOAuthAuthorizationRequestTable.expiresAt, now));
  await db.insert(mcpOAuthAuthorizationRequestTable).values({
    id: requestId,
    ...params,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });
  await db.execute(sql`
    DELETE FROM ${mcpOAuthAuthorizationRequestTable}
    WHERE ${mcpOAuthAuthorizationRequestTable.id} IN (
      SELECT ${mcpOAuthAuthorizationRequestTable.id}
      FROM ${mcpOAuthAuthorizationRequestTable}
      ORDER BY ${mcpOAuthAuthorizationRequestTable.expiresAt} DESC
      OFFSET ${maxAuthorizationRequests}
    )
  `);
  return requestId;
}

export async function getAuthorizationRequest(
  requestId: string,
): Promise<AuthorizationRequest | undefined> {
  const [request] = await db
    .select()
    .from(mcpOAuthAuthorizationRequestTable)
    .where(
      and(
        eq(mcpOAuthAuthorizationRequestTable.id, requestId),
        gt(mcpOAuthAuthorizationRequestTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!request) return undefined;
  return {
    clientId: request.clientId,
    codeChallenge: request.codeChallenge,
    redirectUri: request.redirectUri,
    state: request.state ?? undefined,
    expiresAt: request.expiresAt.getTime(),
  };
}

export async function consumeAuthorizationRequest(
  requestId: string,
): Promise<AuthorizationRequest | undefined> {
  const [request] = await db
    .delete(mcpOAuthAuthorizationRequestTable)
    .where(
      and(
        eq(mcpOAuthAuthorizationRequestTable.id, requestId),
        gt(mcpOAuthAuthorizationRequestTable.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!request) return undefined;
  return {
    clientId: request.clientId,
    codeChallenge: request.codeChallenge,
    redirectUri: request.redirectUri,
    state: request.state ?? undefined,
    expiresAt: request.expiresAt.getTime(),
  };
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
  const [stored] = await db
    .delete(mcpOAuthCodeTable)
    .where(eq(mcpOAuthCodeTable.id, code))
    .returning();
  if (!stored) return null;

  if (stored.clientId !== clientId) return null;
  if (stored.redirectUri !== redirectUri) return null;
  if (stored.expiresAt.getTime() < Date.now()) return null;
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
