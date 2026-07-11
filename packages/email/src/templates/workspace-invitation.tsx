import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { resolveEmailLocale } from "./resolve-locale";
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
  fr: {
    preview: "Vous êtes invité à rejoindre {{workspaceName}} sur Kaneo",
    title: "Rejoindre {{workspaceName}}",
    subtitle:
      "{{inviterName}} ({{inviterEmail}}) vous invite à collaborer sur Kaneo.",
    cta: "Accepter l’invitation",
    sameEmail:
      "Vous pouvez accepter l’invitation avec l’adresse e-mail qui a reçu ce message.",
    ignore:
      "Si vous ne vous attendiez pas à recevoir ce message, vous pouvez l’ignorer.",
    footer: "Invitation à un espace de travail Kaneo",
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
}: WorkspaceInvitationEmailProps) => {
  const copy =
    messages[resolveEmailLocale(locale, ["en", "de", "fr"] as const)];
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
};

WorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Acme Inc",
  inviterName: "John Doe",
  inviterEmail: "john@acme.com",
  invitationLink: "https://kaneo.app/invite/abc123",
  to: "invitee@example.com",
} as WorkspaceInvitationEmailProps;

export default WorkspaceInvitationEmail;
