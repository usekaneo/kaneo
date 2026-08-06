import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { resolveEmailLocale } from "./resolve-locale";
import { EmailShell, styles } from "./shell";

void React;

export type NotificationEmailProps = {
  title: string;
  message: string;
  actionUrl?: string | null;
  actionLabel?: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview: "You have a new Kaneo notification",
    subtitle: "A notification matched your delivery preferences.",
    footer: "Kaneo notification",
    actionLabel: "Open in Kaneo",
  },
  de: {
    preview: "Du hast eine neue Kaneo-Benachrichtigung",
    subtitle:
      "Eine Benachrichtigung entspricht deinen Zustellungs-Einstellungen.",
    footer: "Kaneo-Benachrichtigung",
    actionLabel: "In Kaneo oeffnen",
  },
} as const;

const NotificationEmail = ({
  title,
  message,
  actionUrl,
  actionLabel,
  locale,
}: NotificationEmailProps) => {
  const copy = messages[resolveEmailLocale(locale)];

  return (
    <EmailShell preview={copy.preview} title={title} subtitle={copy.subtitle}>
      <Section>
        <Text style={styles.paragraph}>{message}</Text>
        {actionUrl ? (
          <Link style={styles.button} href={actionUrl}>
            {actionLabel ?? copy.actionLabel}
          </Link>
        ) : null}
        <Section style={styles.divider} />
        <Text style={styles.footer}>{copy.footer}</Text>
      </Section>
    </EmailShell>
  );
};

NotificationEmail.PreviewProps = {
  title: "Task assigned to you",
  message: "You were assigned to Design account notifications.",
  actionUrl: "https://kaneo.app",
} as NotificationEmailProps;

export default NotificationEmail;
