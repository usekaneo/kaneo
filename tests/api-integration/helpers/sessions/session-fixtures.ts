import { eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import { vi } from "vite-plus/test";
import db, { schema } from "../../../../apps/api/src/database";
import type { createApp } from "../../../../apps/api/src/index";
import {
  addUserConnection,
  removeUserConnection,
} from "../../../../apps/api/src/ws";

type App = ReturnType<typeof createApp>["app"];

export const FIREFOX_ON_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

/** The session row behind a cookie jar, found by the session token in it. */
export async function sessionIdOf(cookies: string) {
  const token = decodeURIComponent(
    /better-auth\.session_token=([^;]+)/.exec(cookies)?.[1] ?? "",
  ).split(".")[0];
  const [session] = await db
    .select({ id: schema.sessionTable.id })
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.token, token ?? ""));
  if (!session) throw new Error("No session for these cookies");
  return session.id;
}

export async function sessionIdsOf(userId: string) {
  const rows = await db
    .select({ id: schema.sessionTable.id })
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.userId, userId));
  return rows.map((row) => row.id).sort();
}

export async function sessionTokens() {
  const rows = await db
    .select({ token: schema.sessionTable.token })
    .from(schema.sessionTable);
  return rows.map((row) => row.token);
}

const connected: Array<() => void> = [];

/** A fake realtime connection registered for a session. */
export function connectSocket(userId: string, sessionId: string | null) {
  const socket = { send: vi.fn(), close: vi.fn() };
  const connection = addUserConnection(
    userId,
    socket as unknown as WSContext,
    sessionId,
  );
  connected.push(() => removeUserConnection(userId, connection));
  return socket;
}

export function disconnectSockets() {
  for (const disconnect of connected.splice(0)) disconnect();
}

export function meStatus(app: App, cookies: string) {
  return app
    .request("/api/user/me", { headers: { cookie: cookies } })
    .then((response) => response.status);
}
