import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { EmailShell, styles } from "./shell";

void React;

export type MagicLinkEmailProps = {
  magicLink: string;
};

const MagicLinkEmail = ({ magicLink }: MagicLinkEmailProps) => (
  <EmailShell
    preview="Sign in to Kaneo"
    title="Your secure sign-in link"
    subtitle="Use this link to continue to your Kaneo workspace."
  >
    <Section>
      <Link style={styles.button} href={magicLink}>
        Sign in to Kaneo
      </Link>
      <Text style={styles.paragraph}>
        This link expires in 5 minutes for your security.
      </Text>
      <Text style={styles.muted}>
        If you didn't request this, you can ignore this email.
      </Text>
      <Section style={styles.divider} />
      <Text style={styles.footer}>Kaneo security email</Text>
    </Section>
  </EmailShell>
);

MagicLinkEmail.PreviewProps = {
  magicLink: "https://kaneo.app",
} as MagicLinkEmailProps;

export default MagicLinkEmail;
