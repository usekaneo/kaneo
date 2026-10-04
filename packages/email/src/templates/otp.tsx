import { Section, Text } from "@react-email/components";
import React from "react";
import { OTP_EXPIRY_SECONDS } from "../otp-expiry";
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
    expiry: `This code expires in ${OTP_EXPIRY_SECONDS / 60} minutes.`,
    ignore: "If you didn't request this, you can ignore this email.",
    footer: "Kaneo security email",
  },
  de: {
    preview: "Dein Kaneo Bestätigungscode",
    title: "Dein Bestätigungscode",
    subtitle: "Gib diesen Einmalcode ein, um die Anmeldung abzuschließen.",
    code: "ist dein Kaneo Bestätigungscode.",
    expiry: `Dieser Code läuft in ${OTP_EXPIRY_SECONDS / 60} Minuten ab.`,
    ignore:
      "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
    footer: "Kaneo Sicherheits-E-Mail",
  },
  vi: {
    preview: "Mã xác minh Kaneo của bạn",
    title: "Mã xác minh của bạn",
    subtitle: "Nhập mã dùng một lần này để hoàn tất đăng nhập.",
    code: "là mã xác minh Kaneo của bạn.",
    expiry: `Mã này sẽ hết hạn sau ${OTP_EXPIRY_SECONDS / 60} phút.`,
    ignore: "Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email này.",
    footer: "Email bảo mật Kaneo",
  },
  ja: {
    preview: "Kaneo の確認コード",
    title: "確認コード",
    subtitle:
      "サインインを完了するには、このワンタイムコードを入力してください。",
    code: "はあなたの Kaneo 確認コードです。",
    expiry: `このコードの有効期限は${OTP_EXPIRY_SECONDS / 60}分です。`,
    ignore: "心当たりがない場合は、このメールを無視してかまいません。",
    footer: "Kaneo セキュリティメール",
  },
  "zh-tw": {
    preview: "你的 Kaneo 驗證碼",
    title: "你的驗證碼",
    subtitle: "輸入這組一次性驗證碼以完成登入。",
    code: "是你的 Kaneo 驗證碼。",
    expiry: `此驗證碼將在 ${OTP_EXPIRY_SECONDS / 60} 分鐘後失效。`,
    ignore: "如果這不是你本人的操作，請忽略這封郵件。",
    footer: "Kaneo 安全性通知",
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
