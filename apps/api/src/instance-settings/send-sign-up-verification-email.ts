import { sendEmailVerificationEmail } from "@kaneo/email";
import { accountEmailSubject } from "../admin/users/account-email-subjects";

type Recipient = { email: string; name?: string | null; locale?: unknown };

function signInUrl() {
  const base = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/auth/sign-in`;
}

/**
 * Email the link better-auth built for a password sign-up. After confirming,
 * the person lands on the web sign-in page instead of the API's root.
 */
export async function sendSignUpVerificationEmail({
  user,
  url,
}: {
  user: Recipient;
  url: string;
}) {
  const link = new URL(url);
  link.searchParams.set("callbackURL", signInUrl());
  const locale = typeof user.locale === "string" ? user.locale : null;
  try {
    await sendEmailVerificationEmail(
      user.email,
      (name) => accountEmailSubject("verification", locale, name),
      {
        verificationLink: link.toString(),
        userName: user.name ?? undefined,
        locale,
        requestedBy: "sign-up",
      },
    );
  } catch {
    // The account stays; signing in with the password sends a new link.
    console.error("Sign-up verification email could not be sent");
  }
}
