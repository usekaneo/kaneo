import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { isOwnerRole } from "../project-access/is-owner-role";
import { normalizeInvitationRole } from "./normalize-invitation-role";

export async function assertInvitationOwnerAllowed(invitation: {
  role: string;
  organizationId: string;
  inviterId: string;
}) {
  if (!isOwnerRole(normalizeInvitationRole(invitation.role))) return;
  const [inviter] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, invitation.organizationId),
        eq(schema.workspaceUserTable.userId, invitation.inviterId),
      ),
    )
    .limit(1);
  if (!isOwnerRole(inviter?.role)) {
    throw new APIError("FORBIDDEN", {
      code: "YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE",
      message: "Only workspace owners can invite owners.",
    });
  }
}
