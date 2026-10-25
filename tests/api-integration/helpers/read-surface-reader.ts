import { createHash, randomUUID } from "node:crypto";
import db, { schema } from "../../../apps/api/src/database";
import type { PermissionMap } from "../../../apps/api/src/utils/role-permissions";
import { mockAnonymousSession, mockAuthenticatedSession } from "./auth";
import { createWorkspaceMember } from "./fixtures";

export async function createReadSurfaceReader(
  authentication: "api-key" | "custom-role",
  permissions: PermissionMap | null,
) {
  const member = await createWorkspaceMember({ role: "limited" });
  const [role] = await db
    .insert(schema.workspaceRoleTable)
    .values({
      workspaceId: member.workspace.id,
      role: "limited",
      permission: JSON.stringify(
        authentication === "custom-role"
          ? permissions
          : {
              task: ["read", "create"],
              project: ["read"],
              workspace: ["read"],
            },
      ),
    })
    .returning();
  const headers: Record<string, string> = {};
  if (authentication === "custom-role") {
    mockAuthenticatedSession(member.user);
  } else {
    mockAnonymousSession();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      permissions: permissions === null ? null : JSON.stringify(permissions),
      enabled: true,
      rateLimitEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    headers["x-api-key"] = key;
  }
  return { ...member, role, headers };
}
