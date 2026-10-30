import { randomBytes } from "node:crypto";
import {
  type AccountPasswordPurpose,
  type EmailResult,
  isSmtpConfigured,
  sendAccountPasswordEmail,
  sendEmailVerificationEmail,
} from "@kaneo/email";
import { createEmailVerificationToken } from "better-auth/api";
import { auth } from "../../auth";
import { accountEmailSubject } from "./account-email-subjects";
import type { AdminTargetUser } from "./find-admin-target-user";

// A new account has longer to act on its first email than a reset link.
const SETUP_LINK_SECONDS = 2 * 24 * 60 * 60;
const VERIFICATION_LINK_SECONDS = 24 * 60 * 60;

type Recipient = Pick<AdminTargetUser, "id" | "name" | "email" | "locale">;

const notConfigured: EmailResult = {
  success: false,
  reason: "SMTP_NOT_CONFIGURED",
};

function clientUrl(path: string) {
  const base = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
  return encodeURIComponent(`${base.replace(/\/$/, "")}${path}`);
}

/**
 * Email a link to choose a password, using the same single-use token and
 * `/reset-password` flow as self-service resets. The link is never returned.
 * Throws when the SMTP server rejects the message.
 */
export async function emailPasswordLink(
  user: Recipient,
  purpose: AccountPasswordPurpose,
): Promise<EmailResult> {
  if (!isSmtpConfigured()) return notConfigured;
  const context = await auth.$context;
  const seconds =
    purpose === "setup"
      ? SETUP_LINK_SECONDS
      : (context.options.emailAndPassword?.resetPasswordTokenExpiresIn ?? 3600);
  const token = randomBytes(18).toString("base64url");
  await context.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: user.id,
    expiresAt: new Date(Date.now() + seconds * 1000),
  });
  return sendAccountPasswordEmail(
    user.email,
    (name) => accountEmailSubject(purpose, user.locale, name),
    {
      purpose,
      passwordLink: `${context.baseURL}/reset-password/${token}?callbackURL=${clientUrl("/auth/reset-password")}`,
      userName: user.name,
      locale: user.locale,
    },
  );
}

/**
 * Email a link that marks the address verified through better-auth's
 * `/verify-email` endpoint. Throws when the SMTP server rejects the message.
 */
export async function emailVerificationLink(
  user: Recipient,
): Promise<EmailResult> {
  if (!isSmtpConfigured()) return notConfigured;
  const context = await auth.$context;
  const token = await createEmailVerificationToken(
    context.secret,
    user.email,
    undefined,
    VERIFICATION_LINK_SECONDS,
  );
  return sendEmailVerificationEmail(
    user.email,
    (name) => accountEmailSubject("verification", user.locale, name),
    {
      verificationLink: `${context.baseURL}/verify-email?token=${token}&callbackURL=${clientUrl("/auth/sign-in")}`,
      userName: user.name,
      locale: user.locale,
    },
  );
}
