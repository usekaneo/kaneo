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
    preview: "Sign in to ElseTasks",
    title: "Your secure sign-in link",
    subtitle: "Use this link to continue to your ElseTasks workspace.",
    cta: "Sign in to ElseTasks",
    expiry: "This link expires in 5 minutes for your security.",
    ignore: "If you didn't request this, you can ignore this email.",
    footer: "ElseTasks security email",
  },
  de: {
    preview: "Bei ElseTasks anmelden",
    title: "Dein sicherer Anmeldelink",
    subtitle:
      "Verwende diesen Link, um mit deinem ElseTasks-Workspace fortzufahren.",
    cta: "Bei ElseTasks anmelden",
    expiry: "Dieser Link laeuft aus Sicherheitsgruenden in 5 Minuten ab.",
    ignore:
      "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
    footer: "ElseTasks Sicherheits-E-Mail",
  },
  vi: {
    preview: "Đăng nhập vào ElseTasks",
    title: "Liên kết đăng nhập an toàn của bạn",
    subtitle:
      "Dùng liên kết này để tiếp tục vào không gian làm việc ElseTasks.",
    cta: "Đăng nhập vào ElseTasks",
    expiry: "Vì lý do bảo mật, liên kết này sẽ hết hạn sau 5 phút.",
    ignore: "Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email này.",
    footer: "Email bảo mật ElseTasks",
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
  magicLink: "https://elsetasks.app",
  locale: "en-US",
} as MagicLinkEmailProps;

export default MagicLinkEmail;
