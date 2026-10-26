import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import type { PermissionMap } from "../../apps/api/src/utils/role-permissions";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createReadSurfaceReader } from "./helpers/read-surface-reader";

beforeEach(resetTestDatabase);

describe("ticket alias current read grants", () => {
  for (const authentication of ["api-key", "custom-role"] as const) {
    it.each<{ permissions: PermissionMap; allowed: boolean }>([
      { permissions: {}, allowed: false },
      { permissions: { label: ["read"] }, allowed: false },
      { permissions: { project: ["read"] }, allowed: false },
      { permissions: { task: ["read"] }, allowed: true },
    ])(
      `${authentication} filters candidates with $permissions`,
      async ({ permissions, allowed }) => {
        const reader = await createReadSurfaceReader(
          authentication,
          permissions,
        );
        const { project } = await createProjectFixture({
          workspaceId: reader.workspace.id,
          slug: "KAN",
        });
        const [task] = await db
          .insert(schema.taskTable)
          .values({
            projectId: project.id,
            number: 12,
            title: "Private title",
            description: "Private description",
          })
          .returning();
        const { app } = createApp();
        for (const query of [
          "",
          `?workspaceId=${reader.workspace.id}`,
          `?workspaceSlug=${reader.workspace.slug}`,
          `?projectId=${project.id}`,
        ]) {
          const response = await app.request(
            `/api/task/by-ticket-id/KAN-12${query}`,
            { headers: reader.headers },
          );
          expect(response.status, query).toBe(allowed ? 200 : 404);
          if (allowed) {
            expect(await response.json()).toMatchObject({
              id: task.id,
              description: task.description,
            });
          } else {
            expect(await response.text()).not.toContain(task.title);
          }
        }
      },
    );
  }

  it("excludes another workspace's identically named role before ambiguity and active-project ranking", async () => {
    const reader = await createReadSurfaceReader("api-key", { task: ["read"] });
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: other.workspace.id,
      userId: reader.user.id,
      role: "limited",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: other.workspace.id,
      role: "limited",
      permission: "{}",
    });
    const allowed = await createProjectFixture({
      workspaceId: reader.workspace.id,
      slug: "KAN",
    });
    const hidden = await createProjectFixture({
      workspaceId: other.workspace.id,
      slug: "KAN",
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: allowed.project.id, number: 12, title: "Readable" })
      .returning();
    await db.insert(schema.taskTable).values({
      projectId: hidden.project.id,
      number: 12,
      title: "Hidden",
    });
    const { app } = createApp();
    const lookup = (query = "") =>
      app.request(`/api/task/by-ticket-id/KAN-12${query}`, {
        headers: reader.headers,
      });
    expect(await (await lookup()).json()).toMatchObject({ id: task.id });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, allowed.project.id));
    expect(await (await lookup()).json()).toMatchObject({ id: task.id });
    for (const query of [
      `?workspaceId=${other.workspace.id}`,
      `?workspaceSlug=${other.workspace.slug}`,
      `?projectId=${hidden.project.id}`,
      `?workspaceId=${reader.workspace.id}&projectId=${hidden.project.id}`,
    ]) {
      expect((await lookup(query)).status).toBe(404);
    }
  });
});
