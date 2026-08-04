import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { resolveEmailLocale } from "./resolve-locale";
import { EmailShell, styles } from "./shell";

void React;

export type PasswordResetEmailProps = {
  resetLink: string;
  userName?: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview: "Reset your Kaneo password",
    title: "Reset your password",
    subtitleWithName: (name: string) =>
      `Hi ${name}, use the button below to set a new password.`,
    subtitleDefault: "Use the button below to set a new password.",
    cta: "Reset password",
    expiry: "This reset link expires in 1 hour.",
    ignore: "If you didn't request this, no changes will be made.",
    footer: "Kaneo security email",
  },
  de: {
    preview: "Setze dein Kaneo-Passwort zurueck",
    title: "Passwort zuruecksetzen",
    subtitleWithName: (name: string) =>
      `Hallo ${name}, verwende die Schaltflaeche unten, um ein neues Passwort festzulegen.`,
    subtitleDefault:
      "Verwende die Schaltflaeche unten, um ein neues Passwort festzulegen.",
    cta: "Passwort zuruecksetzen",
    expiry: "Dieser Link laeuft in 1 Stunde ab.",
    ignore:
      "Wenn du das nicht angefordert hast, werden keine Aenderungen vorgenommen.",
    footer: "Kaneo Sicherheits-E-Mail",
  },
  vi: {
    preview: "Đặt lại mật khẩu Kaneo của bạn",
    title: "Đặt lại mật khẩu",
    subtitleWithName: (name: string) =>
      `Chào ${name}, hãy dùng nút bên dưới để đặt mật khẩu mới.`,
    subtitleDefault: "Hãy dùng nút bên dưới để đặt mật khẩu mới.",
    cta: "Đặt lại mật khẩu",
    expiry: "Liên kết đặt lại này sẽ hết hạn sau 1 giờ.",
    ignore:
      "Nếu bạn không yêu cầu điều này, sẽ không có thay đổi nào được thực hiện.",
    footer: "Email bảo mật Kaneo",
  },
} as const;

const PasswordResetEmail = ({
  resetLink,
  userName,
  locale,
}: PasswordResetEmailProps) => {
  const copy = messages[resolveEmailLocale(locale)];

  return (
    <EmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={
        userName ? copy.subtitleWithName(userName) : copy.subtitleDefault
      }
    >
      <Section>
        <Link style={styles.button} href={resetLink}>
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

PasswordResetEmail.PreviewProps = {
  resetLink: "https://kaneo.app/auth/reset-password?token=example",
  userName: "Jane",
} as PasswordResetEmailProps;

export default PasswordResetEmail;
