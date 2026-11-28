import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { listWorkspaceRecipientIds } from "../../apps/api/src/ws/list-workspace-recipient-ids";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

async function createUser(role: string | null) {
  const id = `user-${randomUUID()}`;
  await db.insert(schema.userTable).values({
    id,
    email: `${id}@example.com`,
    emailVerified: true,
    name: "Recipient Test User",
    role,
  });
  return id;
}

describe("listWorkspaceRecipientIds", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("includes members and instance admins once, and nobody else", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const admin = await createUser("admin");
    const outsider = await createUser(null);
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: admin,
      role: "member",
      joinedAt: new Date(),
    });
    const adminWithoutMembership = await createUser("user,admin");

    const recipients = await listWorkspaceRecipientIds(owner.workspace.id);

    expect(recipients.sort()).toEqual(
      [owner.user.id, admin, adminWithoutMembership].sort(),
    );
    expect(recipients).not.toContain(outsider);
  });
});
