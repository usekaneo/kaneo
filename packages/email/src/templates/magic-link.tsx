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
  vi: {
    preview: "Đăng nhập vào Kaneo",
    title: "Liên kết đăng nhập an toàn của bạn",
    subtitle: "Dùng liên kết này để tiếp tục vào không gian làm việc Kaneo.",
    cta: "Đăng nhập vào Kaneo",
    expiry: "Vì lý do bảo mật, liên kết này sẽ hết hạn sau 5 phút.",
    ignore: "Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email này.",
    footer: "Email bảo mật Kaneo",
  },
  ja: {
    preview: "Kaneo にサインイン",
    title: "安全なサインインリンク",
    subtitle: "このリンクから Kaneo ワークスペースにアクセスできます。",
    cta: "Kaneo にサインイン",
    expiry: "セキュリティのため、このリンクは5分で有効期限が切れます。",
    ignore: "心当たりがない場合は、このメールを無視してかまいません。",
    footer: "Kaneo セキュリティメール",
  },
  "zh-tw": {
    preview: "登入 Kaneo",
    title: "你的安全登入連結",
    subtitle: "使用此連結繼續前往你的 Kaneo 工作區。",
    cta: "登入 Kaneo",
    expiry: "為了你的帳號安全，此連結將在 5 分鐘後失效。",
    ignore: "如果這不是你本人的操作，請忽略這封郵件。",
    footer: "Kaneo 安全性通知",
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
