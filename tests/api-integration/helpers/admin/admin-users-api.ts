import { createApp } from "../../../../apps/api/src/index";
import { signUpWithSession } from "../auth-session";

type App = ReturnType<typeof createApp>["app"];

/** Requests to `/api/admin/users...` with the given headers. */
export function adminUsersApi(app: App, headers: Record<string, string>) {
  return (path: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(`/api/admin/users${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        "user-agent": "admin-users-test",
        ...headers,
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
}

/** A signed-in instance administrator and a regular user to act on. */
export async function adminWithTarget() {
  const { app } = createApp();
  const admin = await signUpWithSession(app, {
    email: "admin@example.com",
    name: "Ada Admin",
    role: "admin",
  });
  const target = await signUpWithSession(app, {
    email: "target@example.com",
    name: "Tom Target",
    role: "user",
  });
  return {
    app,
    admin,
    target,
    asAdmin: adminUsersApi(app, { cookie: admin.cookies }),
  };
}
