import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { MAX_LABEL_DELETIONS_IN_FLIGHT } from "../../apps/api/src/label/deletion-lock";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seedApiKey(
  userId: string,
  permissions: Record<string, string[]> | null,
) {
  const key = `error-shape-${userId}`.padEnd(64, "x");
  await db.insert(schema.apikeyTable).values({
    referenceId: userId,
    userId,
    key: createHash("sha256").update(key).digest("base64url"),
    permissions: permissions ? JSON.stringify(permissions) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return key;
}

function createTask(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.request(`/api/task/${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const validTask = {
  title: "Error shape probe",
  description: "",
  priority: "low",
  status: "to-do",
};

describe("API integration: error shape", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("serializes an HTTPException as JSON with a derived code", async () => {
    const { app } = createApp();

    const response = await app.request("/api/user/me");

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toEqual({
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("reports every validation issue under VALIDATION_ERROR", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await createTask(app, project.id, {
      priority: "urgent-ish",
      status: 5,
    });

    expect(response.status).toBe(400);
    const body = await readErrorBody(response);
    expect(body.code).toBe("VALIDATION_ERROR");
    const paths = body.issues?.map((issue) => issue.path) ?? [];
    expect(paths).toEqual(
      expect.arrayContaining([
        "body.title",
        "body.description",
        "body.priority",
        "body.status",
      ]),
    );
    const [first] = body.issues ?? [];
    expect(body.message).toBe(
      `${first?.path.replace(/^body\./, "")}: ${first?.message}`,
    );
  });

  it("validates top-level routes with the same hook", async () => {
    const { app } = createApp();

    const response = await app.request("/api/auth/device?ui=2");

    expect(response.status).toBe(400);
    const body = await readErrorBody(response);
    expect(body).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(body.message).toMatch(/^ui: /);
    expect(body.issues).toEqual([
      { path: "query.ui", message: expect.any(String) },
    ]);
  });

  it("keeps fixed public-project messages in the standard shape", async () => {
    const { app } = createApp();

    const response = await app.request(
      "/api/public-project/missing?page=0&limit=1",
    );

    expect(response.status).toBe(400);
    const body = await readErrorBody(response);
    expect(body).toMatchObject({
      message: "Invalid task pagination or filters",
      code: "VALIDATION_ERROR",
    });
    expect(body.issues?.[0]?.path).toMatch(/^query\./);
  });

  it("names the permissions a member lacks", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();

    const response = await createTask(app, project.id, validTask);

    expect(response.status).toBe(403);
    expect(await readErrorBody(response)).toEqual({
      message: "Insufficient permissions",
      code: "MISSING_PERMISSION",
      missingPermissions: ["task:create"],
    });
  });

  it("names the permissions an API key's scope lacks", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const key = await seedApiKey(member.user.id, { task: ["read"] });
    const { app } = createApp();

    const response = await createTask(app, project.id, validTask, {
      "x-api-key": key,
    });

    expect(response.status).toBe(403);
    expect(await readErrorBody(response)).toEqual({
      message: "Insufficient API key scope",
      code: "API_KEY_SCOPE",
      missingPermissions: ["task:create"],
    });
  });

  it("rejects API keys on session-only routes with SESSION_REQUIRED", async () => {
    const member = await createWorkspaceMember();
    const key = await seedApiKey(member.user.id, null);
    const { app } = createApp();

    const response = await app.request("/api/oauth/id-token", {
      headers: { Authorization: `Bearer ${key}` },
    });

    expect(response.status).toBe(403);
    expect(await readErrorBody(response)).toEqual({
      message: "A user session is required",
      code: "SESSION_REQUIRED",
    });
  });

  it("answers unknown API routes with a JSON 404 and leaves other paths alone", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const unknownApi = await app.request("/api/does-not-exist");
    expect(unknownApi.status).toBe(404);
    expect(await readErrorBody(unknownApi)).toEqual({
      message: "Not found",
      code: "NOT_FOUND",
    });

    const unknownAuth = await app.request("/api/auth/does-not-exist");
    expect(unknownAuth.status).toBe(404);
    expect(await readErrorBody(unknownAuth)).toEqual({
      message: "Not found",
      code: "NOT_FOUND",
    });

    const unknownPage = await app.request("/does-not-exist");
    expect(unknownPage.status).toBe(404);
    expect(unknownPage.headers.get("content-type")).not.toContain(
      "application/json",
    );
  });

  it("hides unhandled failures behind a JSON 500", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    app.get("/api/error-shape-failure", () => {
      throw new Error("private failure detail");
    });

    const response = await app.request("/api/error-shape-failure");

    expect(response.status).toBe(500);
    expect(await readErrorBody(response)).toEqual({
      message: "Internal Server Error",
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("keeps Retry-After on a busy lock while converting its body", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const [label] = await db
      .insert(schema.labelTable)
      .values({ workspaceId: member.workspace.id, name: "bug", color: "red" })
      .returning();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const other = await getDatabasePool().connect();
    try {
      for (let slot = 0; slot < MAX_LABEL_DELETIONS_IN_FLIGHT; slot++)
        await other.query("SELECT pg_advisory_lock(773622, $1::int)", [slot]);

      const response = await app.request(`/api/label/${label.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("1");
      expect(await readErrorBody(response)).toEqual({
        message: "Label deletion is busy; retry this request",
        code: "RATE_LIMITED",
      });
    } finally {
      await other.query("SELECT pg_advisory_unlock_all()");
      other.release();
    }
  });

  it("keeps the OAuth error shape on MCP OAuth endpoints", async () => {
    const { app } = createApp();

    const response = await app.request("/api/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["https://client.example/callback"],
        grant_types: ["refresh_token"],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ error: "invalid_client_metadata" });
    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("message");
  });

  it("answers a rejected API key on auth routes with JSON", async () => {
    const { app } = createApp();

    const response = await app.request("/api/auth/get-session", {
      headers: { "x-api-key": "not-a-real-key" },
    });

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toEqual({
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("returns Better Auth errors with a message and code", async () => {
    const { app } = createApp();

    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "definitely wrong password",
      }),
    });

    expect(response.status).toBe(401);
    const body = await readErrorBody(response);
    expect(body.message).toEqual(expect.any(String));
    expect(body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("keeps RFC 8628 errors while polling for a device token", async () => {
    const { app } = createApp();
    const origin = "http://localhost:5173";

    const codeResponse = await app.request("/api/auth/device/code", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: origin },
      body: JSON.stringify({ client_id: "kaneo-cli" }),
    });
    const { device_code } = (await codeResponse.json()) as {
      device_code: string;
    };

    const response = await app.request("/api/auth/device/token", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: origin },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code,
        client_id: "kaneo-cli",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "authorization_pending",
    });
  });
});
