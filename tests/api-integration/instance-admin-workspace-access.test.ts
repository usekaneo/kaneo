import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { validateWorkspaceAccess } from "../../apps/api/src/utils/validate-workspace-access";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

async function createUser(role: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      email: `${id}@example.com`,
      emailVerified: true,
      name: "Outsider",
      role,
    })
    .returning();
  return user;
}

describe("API integration: instance admin workspace access", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lets a multi-role instance admin into a workspace they never joined", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const admin = await createUser("user,admin");

    await expect(
      validateWorkspaceAccess(admin.id, owner.workspace.id),
    ).resolves.toBeUndefined();
  });

  it("still rejects a plain user who is not a member", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const outsider = await createUser("user");

    await expect(
      validateWorkspaceAccess(outsider.id, owner.workspace.id),
    ).rejects.toMatchObject({
      status: 404,
      message: "Workspace not found",
    });
  });

  it("rejects an instance admin for a workspace that does not exist", async () => {
    const admin = await createUser("user,admin");

    await expect(
      validateWorkspaceAccess(
        admin.id,
        `workspace-${randomUUID()}`,
        undefined,
        {
          notFoundMessage: "Project not found",
        },
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: "Project not found",
    });
  });
});
