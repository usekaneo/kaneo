import React from "react";
import { EmailIntro } from "../../components/email-intro";
import { EmailButton } from "../../components/email-button";
import { EmailNote } from "../../components/email-note";
import { FallbackLink } from "../../components/fallback-link";
import { EmailLayout } from "./email-layout";
void React;
interface PasswordResetEmailProps {
  resetLink: string;
  logoUrl?: string;
}
export function PasswordResetEmail({
  resetLink,
  logoUrl,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your Quills password" logoUrl={logoUrl}>
      <EmailIntro
        title="Reset your password"
        subtitle="Use the button below to choose a new password for your account. This link expires in 24 hours."
      />
      <EmailButton href={resetLink}>Reset password</EmailButton>
      <FallbackLink
        label="Button not working? Paste this link into your browser:"
        href={resetLink}
      />
      <EmailNote title="Didn't request a password reset?">
        You can safely ignore this email. Your password will stay the same.
      </EmailNote>
    </EmailLayout>
  );
}
