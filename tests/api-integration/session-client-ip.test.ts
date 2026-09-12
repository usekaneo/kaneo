import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

async function signUpWithForwardedFor(forwardedFor: string) {
  const { app } = createApp();
  const email = `ip-${randomUUID()}@example.com`;

  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwardedFor,
    },
    body: JSON.stringify({
      email,
      password: "TestPassw0rd!23",
      name: "IP Probe",
    }),
  });

  expect(response.status).toBeLessThan(400);

  const [user] = await db
    .select()
    .from(schema.userTable)
    .where(eq(schema.userTable.email, email));

  const [session] = await db
    .select()
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.userId, user.id))
    .orderBy(desc(schema.sessionTable.createdAt))
    .limit(1);

  return session;
}

describe("session records the real client IP behind the proxy chain", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stores the client, not the in-image nginx or Caddy hop", async () => {
    const session = await signUpWithForwardedFor("203.0.113.9, 172.19.0.5");

    expect(session.ipAddress).toBe("203.0.113.9");
  });

  it("still works with a single proxy in front", async () => {
    const session = await signUpWithForwardedFor("203.0.113.40");

    expect(session.ipAddress).toBe("203.0.113.40");
  });
});
