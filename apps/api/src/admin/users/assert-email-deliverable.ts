import { type EmailResult, isSmtpConfigured } from "@kaneo/email";
import { ApiError } from "../../errors/api-error";
import type { AdminTargetUser } from "./find-admin-target-user";

/** Guests have generated addresses, and nothing can be sent without SMTP. */
export function assertEmailDeliverable(user: AdminTargetUser) {
  if (user.isAnonymous) {
    throw new ApiError(409, {
      code: "GUEST_ACCOUNT",
      message: "Guest accounts have no email address to send to.",
    });
  }
  if (!isSmtpConfigured()) throw notConfigured();
}

function notConfigured() {
  return new ApiError(503, {
    code: "EMAIL_DELIVERY_NOT_CONFIGURED",
    message:
      "Email delivery is not configured on this instance. Configure SMTP to send emails.",
  });
}

export async function deliverOrThrow(send: () => Promise<EmailResult>) {
  let result: EmailResult;
  try {
    result = await send();
  } catch {
    throw new ApiError(502, {
      code: "EMAIL_DELIVERY_FAILED",
      message:
        "The email could not be sent. Check the SMTP settings and try again.",
    });
  }
  if (!result.success) throw notConfigured();
}
