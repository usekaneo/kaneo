import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { desc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

async function signUpWithForwardedFor(forwardedFor: string) {
  const { app } = createApp();
  const email = `ip-${randomUUID()}@example.com`;

  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await once(server, "listening");
  let response: Response;
  try {
    response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/sign-up/email`,
      {
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
      },
    );

    await response.text();
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
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
    vi.stubEnv("TRUSTED_PROXIES", "127.0.0.0/8,172.19.0.5");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("stores the client, not the in-image nginx or Caddy hop", async () => {
    const session = await signUpWithForwardedFor("203.0.113.9, 172.19.0.5");

    expect(session.ipAddress).toBe("203.0.113.9");
  });

  it("still works with a single proxy in front", async () => {
    const session = await signUpWithForwardedFor("203.0.113.40");

    expect(session.ipAddress).toBe("203.0.113.40");
  });
});
