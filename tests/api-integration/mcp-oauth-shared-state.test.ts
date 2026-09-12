import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";

describe("API integration: shared MCP OAuth state", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("shares clients, authorization requests and codes across module instances", async () => {
    const firstReplica = await import("../../apps/api/src/mcp/oauth");
    const redirectUri = "https://client.example/callback";
    const verifier = "shared-state-verifier";
    const codeChallenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    const client = await firstReplica.registerClient({
      redirectUris: [redirectUri],
      clientName: "Cross-replica test",
    });
    const requestId = await firstReplica.createAuthorizationRequest({
      clientId: client.clientId,
      redirectUri,
      codeChallenge,
    });

    vi.resetModules();
    const secondReplica = await import("../../apps/api/src/mcp/oauth");
    await expect(
      secondReplica.getClient(client.clientId),
    ).resolves.toMatchObject({
      clientId: client.clientId,
      redirectUris: [redirectUri],
    });
    await expect(
      secondReplica.getAuthorizationRequest(requestId),
    ).resolves.toMatchObject({ clientId: client.clientId, redirectUri });
    await expect(
      secondReplica.consumeAuthorizationRequest(requestId),
    ).resolves.toMatchObject({ clientId: client.clientId, redirectUri });
    await expect(
      firstReplica.getAuthorizationRequest(requestId),
    ).resolves.toBeNull();

    const userId = randomUUID();
    await db.insert(schema.userTable).values({
      id: userId,
      name: "MCP OAuth test user",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const code = await secondReplica.createAuthCode({
      clientId: client.clientId,
      userId,
      redirectUri,
      codeChallenge,
    });

    vi.resetModules();
    const thirdReplica = await import("../../apps/api/src/mcp/oauth");
    await expect(
      thirdReplica.exchangeCode(code, client.clientId, verifier, redirectUri),
    ).resolves.toMatchObject({ expiresIn: 30 * 24 * 60 * 60 });
    await expect(
      thirdReplica.exchangeCode(code, client.clientId, verifier, redirectUri),
    ).resolves.toBeNull();
  });
});
