import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import type { PermissionMap } from "../../apps/api/src/utils/role-permissions";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { createReadSurfaceReader } from "./helpers/read-surface-reader";

const { readObject } = vi.hoisted(() => ({
  readObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));
vi.mock("../../apps/api/src/storage/s3", async (original) => ({
  ...(await original<object>()),
  getPrivateObject: readObject,
}));

beforeEach(async () => {
  await resetTestDatabase();
  readObject.mockClear();
});

async function fixture(
  authentication: "api-key" | "custom-role",
  permissions: PermissionMap | null,
) {
  const reader = await createReadSurfaceReader(authentication, permissions);
  const { project } = await createProjectFixture({
    workspaceId: reader.workspace.id,
  });
  const assets = await db
    .insert(schema.assetTable)
    .values(
      ["description", "comment", "draft", "draft-pending"].map((surface) => ({
        workspaceId: reader.workspace.id,
        projectId: project.id,
        objectKey: randomUUID(),
        filename: "private.png",
        mimeType: "image/png",
        size: 3,
        surface,
        createdBy: reader.user.id,
      })),
    )
    .returning();
  return { ...reader, project, assets, ...createApp() };
}

describe("private asset current grants", () => {
  for (const authentication of ["api-key", "custom-role"] as const) {
    it.each<PermissionMap>([
      {},
      { label: ["read"] },
      { project: ["read"] },
      { task: ["read"] },
      { task: ["create"] },
    ])(
      `${authentication} enforces private surface grants %j`,
      async (permissions) => {
        const { app, headers, assets } = await fixture(
          authentication,
          permissions,
        );
        // Both key transports must retain the parsed scope in the asset resolver.
        const transports =
          authentication === "api-key"
            ? [headers, { Authorization: `Bearer ${headers["x-api-key"]}` }]
            : [headers];
        for (const requestHeaders of transports) {
          for (const asset of assets) {
            const required = asset.surface.startsWith("draft")
              ? "create"
              : "read";
            const allowed = permissions.task?.includes(required) ?? false;
            const before = readObject.mock.calls.length;
            const response = await app.request(`/api/asset/${asset.id}`, {
              headers: requestHeaders,
            });
            expect(response.status, asset.surface).toBe(allowed ? 200 : 403);
            expect(readObject.mock.calls.length).toBe(
              before + (allowed ? 1 : 0),
            );
          }
        }
      },
    );
  }

  it("rechecks role demotion for an unscoped legacy key while keeping public descriptions public", async () => {
    const { app, headers, assets, role, project } = await fixture(
      "api-key",
      null,
    );
    const comment = assets.find((asset) => asset.surface === "comment")!;
    const before = await app.request(`/api/asset/${comment.id}`, { headers });
    expect(before.status).toBe(200);
    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: "{}" })
      .where(eq(schema.workspaceRoleTable.id, role.id));
    readObject.mockClear();
    const after = await app.request(`/api/asset/${comment.id}`, { headers });
    expect(after.status).toBe(403);
    expect(readObject).not.toHaveBeenCalled();
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    for (const asset of assets) {
      const response = await app.request(`/api/asset/${asset.id}`, { headers });
      expect(response.status).toBe(asset.surface === "description" ? 200 : 403);
    }
  });

  it("preserves draft ownership even with task:create scope", async () => {
    const { app, headers, assets } = await fixture("api-key", {
      task: ["create"],
    });
    const draft = assets.find((asset) => asset.surface === "draft")!;
    await db
      .update(schema.assetTable)
      .set({ createdBy: null })
      .where(eq(schema.assetTable.id, draft.id));
    readObject.mockClear();
    const response = await app.request(`/api/asset/${draft.id}`, { headers });
    expect(response.status).toBe(403);
    expect(readObject).not.toHaveBeenCalled();
  });
});
