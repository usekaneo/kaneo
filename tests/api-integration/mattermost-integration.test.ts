import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const webhookUrl = "https://127.0.0.1/hooks/mattermost-secret-token";

describe("API integration: Mattermost", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves webhook validation and settings across the OpenAPI routes", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const path = `/api/mattermost-integration/project/${project.id}`;
    const request = (method: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    expect(await (await request("GET")).json()).toBeNull();
    expect(
      (await request("POST", { webhookUrl: "http://127.0.0.1/hooks/test" }))
        .status,
    ).toBe(400);
    const created = await request("POST", {
      webhookUrl,
      channelName: " Test channel ",
    });
    expect(created.status).toBe(200);
    const body = await created.json();
    expect(body).toMatchObject({
      projectId: project.id,
      channelName: "Test channel",
      webhookConfigured: true,
      isActive: true,
      events: {
        taskCreated: true,
        taskStatusChanged: true,
        taskCommentCreated: true,
        taskPriorityChanged: false,
      },
    });
    expect(JSON.stringify(body)).not.toContain(webhookUrl);
    expect(body.createdAt).toEqual(expect.any(String));

    const updated = await request("PATCH", {
      isActive: false,
      channelName: null,
      events: { taskCreated: false },
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      isActive: false,
      channelName: null,
      events: {
        taskCreated: false,
        taskStatusChanged: true,
        taskCommentCreated: true,
      },
    });
    expect((await request("PATCH", { webhookUrl: "" })).status).toBe(400);
    const stored = await db.query.integrationTable.findFirst({
      where: eq(schema.integrationTable.id, body.id),
    });
    expect(stored).toBeDefined();
    if (!stored) throw new Error("Mattermost integration was not persisted");
    expect(JSON.parse(stored.config).webhookUrl).toBe(webhookUrl);
    expect(stored.isActive).toBe(false);

    const replaced = await request("POST", { webhookUrl });
    expect(replaced.status).toBe(200);
    expect(await replaced.json()).toMatchObject({
      id: body.id,
      isActive: true,
    });
    expect((await request("DELETE")).status).toBe(200);
    expect(await (await request("GET")).json()).toBeNull();
    expect((await request("PATCH", { isActive: true })).status).toBe(404);
    expect((await request("DELETE")).status).toBe(404);
  });

  it("retains workspace permission checks for mutations", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();
    const path = `/api/mattermost-integration/project/${project.id}`;
    expect((await app.request(path)).status).toBe(200);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const response = await app.request(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify({ webhookUrl }),
      });
      expect(response.status).toBe(403);
    }
  });
});
