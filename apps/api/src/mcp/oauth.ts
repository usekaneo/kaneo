import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
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

type AuthorizationContext = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  expiresAt: number;
};

const clients = new Map<string, RegisteredClient>();
const codes = new Map<string, AuthCode>();

function getAuthorizationSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required");
  }
  return secret;
}

function signAuthorizationContext(payload: string): string {
  return createHmac("sha256", getAuthorizationSecret())
    .update(payload)
    .digest("base64url");
}

export function createAuthorizationContext(
  params: Omit<AuthorizationContext, "expiresAt">,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...params,
      expiresAt: Date.now() + 10 * 60 * 1000,
    } satisfies AuthorizationContext),
  ).toString("base64url");
  return `${payload}.${signAuthorizationContext(payload)}`;
}

export function verifyAuthorizationContext(
  token: string,
): AuthorizationContext | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(signAuthorizationContext(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const context = value as Partial<AuthorizationContext>;
  if (
    typeof context.clientId !== "string" ||
    typeof context.redirectUri !== "string" ||
    typeof context.codeChallenge !== "string" ||
    (context.state !== undefined && typeof context.state !== "string") ||
    typeof context.expiresAt !== "number" ||
    context.expiresAt < Date.now()
  ) {
    return null;
  }

  return context as AuthorizationContext;
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
    redirectUris: [...params.redirectUris],
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
