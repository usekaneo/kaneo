import { randomUUID } from "node:crypto";
import db, { schema } from "../../../../apps/api/src/database";
import type { createApp } from "../../../../apps/api/src/index";
import { signUpWithSession } from "../auth-session";

type App = ReturnType<typeof createApp>["app"];

/** Requests to `/api/admin...` with the given headers. */
export function adminApi(app: App, headers: Record<string, string>) {
  return (path: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(`/api/admin${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        "user-agent": "instance-roles-test",
        ...headers,
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
}

export async function insertInstanceRole(name: string, permissions: string[]) {
  const [role] = await db
    .insert(schema.instanceRoleTable)
    .values({ name, permissions })
    .returning();
  return role;
}

/** A signed-in user holding `role`, with an admin API client. */
export async function signInWithRole(app: App, role: string) {
  const email = `${role}-${randomUUID()}@example.com`;
  const user = await signUpWithSession(app, { email, name: role, role });
  return {
    ...user,
    email,
    api: adminApi(app, { cookie: user.cookies }),
  };
}

/** A user without a session, to act on. */
export async function insertUser(role = "user") {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, name: "Target", role })
    .returning();
  return user;
}
