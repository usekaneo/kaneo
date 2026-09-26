import { eq } from "drizzle-orm";
import { expect } from "vitest";
import db, { schema } from "../../../apps/api/src/database";
import type { createApp } from "../../../apps/api/src/index";

type App = ReturnType<typeof createApp>["app"];

const PASSWORD = "correct horse battery staple";

function collectCookies(response: Response) {
  const jar = new Map<string, string>();
  for (const setCookie of response.headers.getSetCookie()) {
    const [pair] = setCookie.split(";");
    const [name, ...value] = (pair ?? "").split("=");
    if (!name || value.join("=") === "") continue;
    jar.set(name, value.join("="));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function signIn(app: App, email: string) {
  const response = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(response.status).toBe(200);
  return collectCookies(response);
}

export async function signUpWithSession(
  app: App,
  {
    email,
    name,
    role,
  }: { email: string; name: string; role?: "admin" | "user" },
) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, name }),
  });
  expect(response.status).toBe(200);
  const { user } = (await response.json()) as { user: { id: string } };

  if (role) {
    await db
      .update(schema.userTable)
      .set({ role })
      .where(eq(schema.userTable.id, user.id));
  }

  return { userId: user.id, cookies: await signIn(app, email) };
}
