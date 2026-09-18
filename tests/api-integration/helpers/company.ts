import { randomUUID } from "node:crypto";
import db, { schema } from "../../../apps/api/src/database";
import { createApp } from "../../../apps/api/src/index";
import { mockAuthenticatedSession } from "./auth";

type User = typeof schema.userTable.$inferSelect;

export async function addWorkspaceMember(
  workspaceId: string,
  role: string,
  name = `${role} user`,
) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, emailVerified: true, name })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

/** Calls the API as `user`; JSON body and content type are handled. */
export function requestAs(user: User) {
  const { app } = createApp();
  return async (
    path: string,
    init?: { method?: string; body?: unknown },
    // biome-ignore lint/suspicious/noExplicitAny: tests assert on response JSON field by field
  ): Promise<{ status: number; json: any }> => {
    // The session mock is global, so set it per request: several users'
    // requesters can be interleaved in one test.
    mockAuthenticatedSession(user);
    const response = await app.request(`/api${path}`, {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    // biome-ignore lint/suspicious/noExplicitAny: tests assert on response JSON field by field
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: response.status, json };
  };
}
