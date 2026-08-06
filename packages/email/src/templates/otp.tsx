import { Section, Text } from "@react-email/components";
import React from "react";
import { resolveEmailLocale } from "./resolve-locale";
import { EmailShell, styles } from "./shell";

void React;

export type OtpEmailProps = {
  otp: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview: "Your Kaneo verification code",
    title: "Your verification code",
    subtitle: "Enter this one-time code to finish signing in.",
    code: "is your Kaneo verification code.",
    expiry: "This code expires in 15 minutes.",
    ignore: "If you didn't request this, you can ignore this email.",
    footer: "Kaneo security email",
  },
  de: {
    preview: "Dein Kaneo Bestaetigungscode",
    title: "Dein Bestaetigungscode",
    subtitle: "Gib diesen Einmalcode ein, um die Anmeldung abzuschliessen.",
    code: "ist dein Kaneo Bestaetigungscode.",
    expiry: "Dieser Code laeuft in 15 Minuten ab.",
    ignore:
      "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
    footer: "Kaneo Sicherheits-E-Mail",
  },
} as const;

const OtpEmail = ({ otp, locale }: OtpEmailProps) => {
  const copy = messages[resolveEmailLocale(locale)];

  return (
    <EmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={copy.subtitle}
    >
      <Section>
        <Text style={styles.paragraph}>
          {otp} {copy.code}
        </Text>
        <Text style={styles.code}>{otp}</Text>
        <Text style={styles.paragraph}>{copy.expiry}</Text>
        <Text style={styles.muted}>{copy.ignore}</Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>{copy.footer}</Text>
      </Section>
    </EmailShell>
  );
};

OtpEmail.PreviewProps = {
  otp: "123456",
  locale: "en-US",
} as OtpEmailProps;

export default OtpEmail;
