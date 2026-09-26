import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

const protocolVersion = "2026-07-28";

async function signUp(app: ReturnType<typeof createApp>["app"]) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      name: "MCP user",
      email: `${randomUUID()}@example.com`,
      password: "mcp-banned-user-password",
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    token: string;
    user: { id: string };
  };
  return { token: body.token, userId: body.user.id };
}

function initialize(app: ReturnType<typeof createApp>["app"], token: string) {
  return app.request("/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-method": "initialize",
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "kaneo-banned-user-test", version: "1.0.0" },
      },
    }),
  });
}

describe("API integration: MCP access for banned users", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stops serving a session token once its owner is banned", async () => {
    const { app } = createApp();
    const { token, userId } = await signUp(app);

    expect((await initialize(app, token)).status).not.toBe(401);

    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, userId));

    expect((await initialize(app, token)).status).toBe(401);
  });
});
