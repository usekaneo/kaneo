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
  locale?: string | null;
};

const messages = {
  en: {
    preview: "You're invited to {{workspaceName}} on Kaneo",
    title: "Join {{workspaceName}}",
    subtitle:
      "{{inviterName}} ({{inviterEmail}}) invited you to collaborate in Kaneo.",
    cta: "Accept invitation",
    sameEmail: "You can accept with the same email that received this message.",
    ignore: "If this wasn't expected, you can safely ignore this email.",
    footer: "Kaneo workspace invitation",
  },
  de: {
    preview: "Du wurdest zu {{workspaceName}} auf Kaneo eingeladen",
    title: "{{workspaceName}} beitreten",
    subtitle:
      "{{inviterName}} ({{inviterEmail}}) hat dich eingeladen, in Kaneo zusammenzuarbeiten.",
    cta: "Einladung annehmen",
    sameEmail:
      "Du kannst die Einladung mit derselben E-Mail-Adresse annehmen, die diese Nachricht erhalten hat.",
    ignore:
      "Falls du damit nicht gerechnet hast, kannst du diese E-Mail einfach ignorieren.",
    footer: "Kaneo Workspace-Einladung",
  },
} as const;

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

const WorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
  to,
  locale,
}: WorkspaceInvitationEmailProps) =>
  (() => {
    const localeKey = locale?.toLowerCase().startsWith("de") ? "de" : "en";
    const copy = messages[localeKey];
    const values = { workspaceName, inviterName, inviterEmail };

    return (
      <EmailShell
        preview={interpolate(copy.preview, values)}
        title={interpolate(copy.title, values)}
        subtitle={interpolate(copy.subtitle, values)}
      >
        <Section>
          <Link style={styles.button} href={`${invitationLink}?email=${to}`}>
            {copy.cta}
          </Link>
          <Text style={styles.paragraph}>{copy.sameEmail}</Text>
          <Text style={styles.muted}>{copy.ignore}</Text>
          <Section style={styles.divider} />
          <Text style={styles.footer}>{copy.footer}</Text>
        </Section>
      </EmailShell>
    );
  })();

WorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Acme Inc",
  inviterName: "John Doe",
  inviterEmail: "john@acme.com",
  invitationLink: "https://kaneo.app/invite/abc123",
  to: "invitee@example.com",
} as WorkspaceInvitationEmailProps;

export default WorkspaceInvitationEmail;
