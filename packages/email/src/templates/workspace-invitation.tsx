import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { EmailShell, styles } from "./shell";

void React;

export type WorkspaceInvitationEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
  to: string;
};

const WorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
  to,
}: WorkspaceInvitationEmailProps) => (
  <EmailShell
    preview={`You're invited to ${workspaceName} on Kaneo`}
    title={`Join ${workspaceName}`}
    subtitle={`${inviterName} (${inviterEmail}) invited you to collaborate in Kaneo.`}
  >
    <Section>
      <Link style={styles.button} href={`${invitationLink}?email=${to}`}>
        Accept invitation
      </Link>
      <Text style={styles.paragraph}>
        You can accept with the same email that received this message.
      </Text>
      <Text style={styles.muted}>
        If this wasn't expected, you can safely ignore this email.
      </Text>
      <Section style={styles.divider} />
      <Text style={styles.footer}>Kaneo workspace invitation</Text>
    </Section>
  </EmailShell>
);

WorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Acme Inc",
  inviterName: "John Doe",
  inviterEmail: "john@acme.com",
  invitationLink: "https://kaneo.app/invite/abc123",
  to: "invitee@example.com",
} as WorkspaceInvitationEmailProps;

export default WorkspaceInvitationEmail;
