import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { EmailShell, styles } from "./shell";

void React;

export type PasswordResetEmailProps = {
  resetLink: string;
  userName?: string;
};

const PasswordResetEmail = ({
  resetLink,
  userName,
}: PasswordResetEmailProps) => (
  <EmailShell
    preview="Reset your Kaneo password"
    title="Reset your password"
    subtitle={
      userName
        ? `Hi ${userName}, use the button below to set a new password.`
        : "Use the button below to set a new password."
    }
  >
    <Section>
      <Link style={styles.button} href={resetLink}>
        Reset password
      </Link>
      <Text style={styles.paragraph}>This reset link expires in 1 hour.</Text>
      <Text style={styles.muted}>
        If you didn't request this, no changes will be made.
      </Text>
      <Section style={styles.divider} />
      <Text style={styles.footer}>Kaneo security email</Text>
    </Section>
  </EmailShell>
);

PasswordResetEmail.PreviewProps = {
  resetLink: "https://kaneo.app/auth/reset-password?token=example",
  userName: "Jane",
} as PasswordResetEmailProps;

export default PasswordResetEmail;
