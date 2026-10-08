import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  createAuthorizationRequest,
  registerClient,
} from "../../apps/api/src/mcp/oauth";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  }),
}));

const invalidBearer = { Authorization: "Bearer not-a-real-token" };

async function createKey(
  userId: string,
  permissions?: Record<string, string[]>,
) {
  const { key } = await auth.api.createApiKey({
    body: { userId, name: "Mixed credentials test", permissions },
  });
  return key;
}

describe("API integration: API key sent with an invalid bearer token", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("does not turn an administrator API key into a session", async () => {
    const { user } = await createWorkspaceMember();
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, user.id));
    const key = await createKey(user.id);
    const { app } = createApp();

    const keyOnly = await app.request("/api/admin/users", {
      headers: { "x-api-key": key },
    });
    expect(keyOnly.status).toBe(403);

    const mixed = await app.request("/api/admin/users", {
      headers: { "x-api-key": key, ...invalidBearer },
    });
    expect(mixed.status).toBe(401);
  });

  it("keeps the API key scope", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const key = await createKey(user.id, { project: ["read"] });
    const { app } = createApp();
    const createProject = (headers: Record<string, string>) =>
      app.request("/api/project", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({
          name: "Scoped",
          workspaceId: workspace.id,
          icon: "Layout",
          slug: "SCP",
        }),
      });

    const keyOnly = await createProject({ "x-api-key": key });
    expect(keyOnly.status).toBe(403);
    expect(await readErrorBody(keyOnly)).toEqual({
      message: "Insufficient API key scope",
      code: "API_KEY_SCOPE",
      missingPermissions: ["project:create"],
    });

    const mixed = await createProject({ "x-api-key": key, ...invalidBearer });
    expect(mixed.status).toBe(401);
    expect(
      await db
        .select()
        .from(schema.projectTable)
        .where(eq(schema.projectTable.workspaceId, workspace.id)),
    ).toHaveLength(0);
  });

  it("rejects private asset downloads", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [asset] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: workspace.id,
        projectId: project.id,
        objectKey: randomUUID(),
        filename: "image.png",
        mimeType: "image/png",
        size: 3,
        surface: "comment",
        createdBy: user.id,
      })
      .returning();
    const key = await createKey(user.id);
    const { app } = createApp();

    const keyOnly = await app.request(`/api/asset/${asset.id}`, {
      headers: { "x-api-key": key },
    });
    expect(keyOnly.status).toBe(200);

    const mixed = await app.request(`/api/asset/${asset.id}`, {
      headers: { "x-api-key": key, ...invalidBearer },
    });
    expect(mixed.status).toBe(401);
  });
});

describe("API integration: MCP consent with an API key", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("requires a user session to approve an authorization request", async () => {
    const { user } = await createWorkspaceMember();
    const key = await createKey(user.id, { project: ["read"] });
    const redirectUri = "https://client.example/callback";
    const client = await registerClient({ redirectUris: [redirectUri] });
    const id = await createAuthorizationRequest({
      clientId: client.clientId,
      codeChallenge: createHash("sha256")
        .update("test-verifier")
        .digest("base64url"),
      redirectUri,
    });
    const { app } = createApp();

    const response = await app.request(`/api/mcp/authorize/request/${id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        "x-api-key": key,
      },
      body: JSON.stringify({ approved: true }),
    });

    expect(response.status).toBe(401);
  });
});
