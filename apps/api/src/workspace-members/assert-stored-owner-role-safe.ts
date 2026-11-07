import { APIError } from "better-auth/api";
import { isOwnerRole } from "../project-access/is-owner-role";
import { normalizeInvitationRole } from "./normalize-invitation-role";

export function assertStoredOwnerRoleSafe(role: string | null | undefined) {
  if (isOwnerRole(normalizeInvitationRole(role)) && !isOwnerRole(role)) {
    throw new APIError("FORBIDDEN", {
      code: "OWNER_ROLE_REVIEW_REQUIRED",
      message: "A workspace owner must review this role before it can be used.",
    });
  }
}
