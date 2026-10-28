import { ApiError } from "../../errors/api-error";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { emailVerificationLink } from "../users/account-email-links";
import {
  assertEmailDeliverable,
  deliverOrThrow,
} from "../users/assert-email-deliverable";
import { findAdminTargetUser } from "../users/find-admin-target-user";

/** Email a user a link that confirms their address. */
async function sendVerificationEmail(userId: string, audit: AdminAuditRequest) {
  const user = await findAdminTargetUser(userId);
  if (user.emailVerified) {
    throw new ApiError(409, {
      code: "EMAIL_ALREADY_VERIFIED",
      message: "This email address is already verified.",
    });
  }
  assertEmailDeliverable(user);
  await deliverOrThrow(() => emailVerificationLink(user));

  await recordAdminAction({
    ...audit,
    action: "user.verification_sent",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.email,
  });
  return { sent: true as const };
}

export default sendVerificationEmail;
