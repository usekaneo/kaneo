import { APIError } from "better-auth/api";
import { and, eq, gt } from "drizzle-orm";
import db, { schema } from "../database";
import { isOwnerRole } from "../project-access/is-owner-role";
import { assertStoredOwnerRoleSafe } from "../workspace-members/assert-stored-owner-role-safe";
import { normalizeInvitationRole } from "../workspace-members/normalize-invitation-role";
import { roleHasWorkspacePermission } from "./require-workspace-permission";

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
  if (!member) return;
  const owner = isOwnerRole(member.role);
  if (
    !owner &&
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
        gt(schema.invitationTable.expiresAt, new Date()),
      ),
    );
  for (const invitation of invitations) {
    // A resend updates expiry before email and skips the creation hook. Old
    // ambiguous owner invitations require review, even when resent by owners.
    assertStoredOwnerRoleSafe(invitation.role);
  }
  if (
    !owner &&
    invitations.some((invitation) =>
      isOwnerRole(normalizeInvitationRole(invitation.role)),
    )
  ) {
    throw new APIError("FORBIDDEN", {
      code: "YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE",
      message: "You are not allowed to invite a user with this role",
    });
  }
}
