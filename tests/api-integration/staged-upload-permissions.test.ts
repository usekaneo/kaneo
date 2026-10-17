import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
const storage = vi.hoisted(() => ({ presign: vi.fn(), verify: vi.fn() }));
vi.mock("../../apps/api/src/storage/s3", async (original) => ({
  ...(await original<typeof import("../../apps/api/src/storage/s3")>()),
  createTaskImageUploadUrl: storage.presign,
  verifyTaskAssetUpload: storage.verify,
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
it.each(["", "/finalize"])(
  "rejects staged upload%s without task creation permission",
  async (suffix) => {
    const { user, workspace } = await createWorkspaceMember({
      role: "draft-reader",
    });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "draft-reader",
      permission: JSON.stringify({ task: ["read"] }),
    });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();
    const response = await app.request(
      `/api/task/draft-upload/${project.id}${suffix}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "private.png",
          contentType: "image/png",
          size: 12,
          surface: "description",
          ...(suffix ? { key: "unclaimed-key" } : {}),
        }),
      },
    );
    expect(response.status).toBe(403);
    expect(storage.presign).not.toHaveBeenCalled();
    expect(storage.verify).not.toHaveBeenCalled();
  },
);
it.each(["", "/finalize"])(
  "rejects comment scope on staged upload%s",
  async (suffix) => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();
    const response = await app.request(
      `/api/task/draft-upload/${project.id}${suffix}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "private.png",
          contentType: "image/png",
          size: 12,
          surface: "comment",
          ...(suffix ? { key: "unclaimed-key" } : {}),
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(storage.presign).not.toHaveBeenCalled();
    expect(storage.verify).not.toHaveBeenCalled();
  },
);
