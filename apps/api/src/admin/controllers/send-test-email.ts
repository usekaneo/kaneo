import {
  getSmtpErrorDetails,
  isSmtpConfigured,
  sendTestEmail,
} from "@kaneo/email";
import { HTTPException } from "hono/http-exception";
import { ApiError } from "../../errors/api-error";
import { createAttemptLimiter } from "../system/attempt-limiter";

const testEmailLimiter = createAttemptLimiter({
  max: 5,
  windowMs: 10 * 60 * 1000,
});

function notConfigured() {
  return new ApiError(409, {
    message:
      "Email is not configured on this instance. Set SMTP_HOST and SMTP_FROM, then restart Kaneo.",
    code: "SMTP_NOT_CONFIGURED",
  });
}

type SendTestEmailInput = {
  userId: string;
  email: string;
};

/**
 * Send an SMTP test to the calling administrator's own address. There is no
 * recipient parameter, so this can't be used to relay mail to anyone else.
 */
async function sendAdminTestEmail({ userId, email }: SendTestEmailInput) {
  if (!isSmtpConfigured()) throw notConfigured();

  const decision = testEmailLimiter.take(userId);
  if (!decision.allowed) {
    throw new HTTPException(429, {
      res: Response.json(
        {
          message: `Too many test emails. Try again in ${decision.retryAfterSeconds} seconds.`,
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfterSeconds) },
        },
      ),
    });
  }

  let result: Awaited<ReturnType<typeof sendTestEmail>>;
  try {
    result = await sendTestEmail(email, "Kaneo test email", {
      requestedAt: new Date(),
    });
  } catch (error) {
    const details = getSmtpErrorDetails(error);
    console.error("Error sending admin test email", details);
    const reason =
      "responseCode" in details
        ? `${details.code} ${details.responseCode}`
        : details.code;
    throw new ApiError(502, {
      message: `The mail server did not accept the test email (${reason}). Check the SMTP settings and the API logs.`,
      code: "SMTP_SEND_FAILED",
    });
  }

  if (!result.success) throw notConfigured();

  return { sent: true as const, to: email };
}

export default sendAdminTestEmail;
