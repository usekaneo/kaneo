import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { hasInstanceAdminRole } from "./instance-admin-role";
import { roleHasWorkspacePermission } from "./require-workspace-permission";
import { splitRoles } from "./split-roles";

export async function hideInvitationsFromNonInviters(
  viewer: { id: string; role?: string | null },
  invitations: unknown,
): Promise<void> {
  if (!Array.isArray(invitations) || invitations.length === 0) return;
  if (hasInstanceAdminRole(viewer.role)) return;

  // Invitation IDs authorize acceptance on instances without email delivery.
  // Membership alone must not expose those credentials.
  const allowed = new Map<string, { canInvite: boolean; owner: boolean }>();
  for (const invitation of invitations) {
    const workspaceId = invitation?.organizationId;
    if (typeof workspaceId !== "string" || allowed.has(workspaceId)) continue;
    const [member] = await db
      .select({ role: schema.workspaceUserTable.role })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, workspaceId),
          eq(schema.workspaceUserTable.userId, viewer.id),
        ),
      )
      .limit(1);
    allowed.set(workspaceId, {
      canInvite: member
        ? await roleHasWorkspacePermission(workspaceId, member.role, {
            invitation: ["create"],
          })
        : false,
      owner: splitRoles(member?.role).includes("owner"),
    });
  }

  const visible = invitations.filter((invitation) => {
    const access = allowed.get(invitation?.organizationId);
    // Better Auth permits any inviter to assign admin/custom roles, but only
    // workspace owners may assign its creator role (owner), including in a
    // multi-role invitation.
    return (
      access?.canInvite &&
      typeof invitation?.role === "string" &&
      (access.owner || !splitRoles(invitation.role).includes("owner"))
    );
  });
  invitations.splice(0, invitations.length, ...visible);
}
