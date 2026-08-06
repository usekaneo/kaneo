import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { resolveEmailLocale } from "./resolve-locale";
import { EmailShell, styles } from "./shell";

void React;

export type MagicLinkEmailProps = {
  magicLink: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview: "Sign in to Kaneo",
    title: "Your secure sign-in link",
    subtitle: "Use this link to continue to your Kaneo workspace.",
    cta: "Sign in to Kaneo",
    expiry: "This link expires in 5 minutes for your security.",
    ignore: "If you didn't request this, you can ignore this email.",
    footer: "Kaneo security email",
  },
  de: {
    preview: "Bei Kaneo anmelden",
    title: "Dein sicherer Anmeldelink",
    subtitle:
      "Verwende diesen Link, um mit deinem Kaneo-Workspace fortzufahren.",
    cta: "Bei Kaneo anmelden",
    expiry: "Dieser Link laeuft aus Sicherheitsgruenden in 5 Minuten ab.",
    ignore:
      "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
    footer: "Kaneo Sicherheits-E-Mail",
  },
} as const;

const MagicLinkEmail = ({ magicLink, locale }: MagicLinkEmailProps) => {
  const copy = messages[resolveEmailLocale(locale)];

  return (
    <EmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={copy.subtitle}
    >
      <Section>
        <Link style={styles.button} href={magicLink}>
          {copy.cta}
        </Link>
        <Text style={styles.paragraph}>{copy.expiry}</Text>
        <Text style={styles.muted}>{copy.ignore}</Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>{copy.footer}</Text>
      </Section>
    </EmailShell>
  );
};

MagicLinkEmail.PreviewProps = {
  magicLink: "https://kaneo.app",
  locale: "en-US",
} as MagicLinkEmailProps;

export default MagicLinkEmail;
