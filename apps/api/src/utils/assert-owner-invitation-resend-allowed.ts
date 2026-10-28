import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { roleHasWorkspacePermission } from "./require-workspace-permission";
import { splitRoles } from "./split-roles";

export async function assertOwnerInvitationResendAllowed(
  userId: string,
  workspaceId: string,
  email: string,
): Promise<void> {
  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  // Let the provider report its normal membership/permission failures.
  if (!member || splitRoles(member.role).includes("owner")) return;
  if (
    !(await roleHasWorkspacePermission(workspaceId, member.role, {
      invitation: ["create"],
    }))
  )
    return;

  const invitations = await db
    .select({ role: schema.invitationTable.role })
    .from(schema.invitationTable)
    .where(
      and(
        eq(schema.invitationTable.workspaceId, workspaceId),
        eq(schema.invitationTable.email, email.toLowerCase()),
        eq(schema.invitationTable.status, "pending"),
      ),
    );
  if (
    invitations.some((invitation) =>
      splitRoles(invitation.role).includes("owner"),
    )
  ) {
    throw new APIError("FORBIDDEN", {
      code: "YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE",
      message: "You are not allowed to invite a user with this role",
    });
  }
}
