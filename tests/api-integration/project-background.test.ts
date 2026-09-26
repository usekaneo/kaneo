import { eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/api/src/storage/s3")>()),
  deleteS3Object: vi.fn().mockResolvedValue(undefined),
}));

function jsonRequest(method: string, body: unknown) {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("API integration: project backgrounds", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await initializeWebSocketAdapter();
    vi.stubEnv("S3_ENDPOINT", "https://storage.example.test");
    vi.stubEnv("S3_BUCKET", "test-backgrounds");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret");
    vi.stubEnv("S3_KEY_PREFIX", "");
  });
  afterEach(async () => {
    await shutdownWebSocketAdapter();
    vi.unstubAllEnvs();
  });

  it("publishes upload and removal to another connected session without leaking storage fields", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const socket = { send: vi.fn(), close: vi.fn(), readyState: 1 };
    const connection = addConnection(
      project.id,
      socket as unknown as WSContext,
      owner.user.id,
      "other-session",
      owner.workspace.id,
    );
    const key = `workspace/${owner.workspace.id}/project/${project.id}/backgrounds/background-v1`;
    try {
      const finalized = await app.request(
        `/api/project/${project.id}/background-upload/finalize`,
        jsonRequest("POST", {
          key,
          version: "v1",
          contentType: "image/png",
          size: 12,
        }),
      );
      expect(finalized.status).toBe(200);
      await vi.waitFor(() =>
        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "PROJECT_UPDATED", projectId: project.id }),
        ),
      );
      socket.send.mockClear();
      for (const path of [
        `/api/project/${project.id}?workspaceId=${owner.workspace.id}`,
        `/api/project?workspaceId=${owner.workspace.id}`,
        `/api/task/tasks/${project.id}`,
      ]) {
        const response = await app.request(path);
        expect(response.status).toBe(200);
        const body = await response.json();
        const data = Array.isArray(body) ? body[0] : (body.data ?? body);
        expect(data.backgroundVersion).toBe("v1");
        expect(data).not.toHaveProperty("backgroundObjectKey");
        expect(data).not.toHaveProperty("backgroundMimeType");
      }
      const updated = await app.request(
        `/api/project/${project.id}`,
        jsonRequest("PUT", {
          name: project.name,
          icon: "Folder",
          slug: project.slug,
          description: "",
          isPublic: false,
        }),
      );
      expect(updated.status).toBe(200);
      expect(await updated.json()).not.toHaveProperty("backgroundObjectKey");
      const removed = await app.request(
        `/api/project/${project.id}/background`,
        { method: "DELETE" },
      );
      expect(removed.status).toBe(204);
      await vi.waitFor(() =>
        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "PROJECT_UPDATED", projectId: project.id }),
        ),
      );
      const row = await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, project.id),
      });
      expect(row).toMatchObject({
        backgroundVersion: null,
        backgroundObjectKey: null,
        backgroundMimeType: null,
      });
    } finally {
      removeConnection(project.id, connection);
    }
  });

  it("rejects background mutations without project update permission", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();
    for (const [path, init] of [
      [
        `/api/project/${project.id}/background-upload`,
        jsonRequest("PUT", { contentType: "image/png", size: 12 }),
      ],
      [
        `/api/project/${project.id}/background-upload/finalize`,
        jsonRequest("POST", {
          key: "key",
          version: "v1",
          contentType: "image/png",
          size: 12,
        }),
      ],
      [`/api/project/${project.id}/background`, { method: "DELETE" }],
    ] as const)
      expect((await app.request(path, init)).status).toBe(403);
  });
});
