import React from "react";
import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { FallbackLink } from "../components/fallback-link";
import { footerLinks } from "../components/footer-links";
import { administratorReason } from "../components/security-reasons";
import { emailHtmlLang, resolveEmailLocale } from "./resolve-locale";

void React;

export type EmailVerificationEmailProps = {
  verificationLink: string;
  userName?: string;
  locale?: string | null;
  email?: string;
  instance?: string;
};

const messages = {
  en: {
    preview: "Confirm that this email address belongs to you.",
    title: "Confirm your email address",
    subtitle: (name?: string) =>
      `${name ? `Hi ${name}, please` : "Please"} confirm that this address belongs to you so it can be used with your Kaneo account. The link expires in 24 hours.`,
    cta: "Confirm email",
    fallback: "Button not working? Paste this link into your browser:",
    noteTitle: "Not your account?",
    note: "You can ignore this email. Nothing changes unless someone opens this link.",
    footer: "Kaneo account email",
  },
  de: {
    preview: "Bestätige, dass diese E-Mail-Adresse dir gehört.",
    title: "Bestätige deine E-Mail-Adresse",
    subtitle: (name?: string) =>
      `${name ? `Hallo ${name}, bitte` : "Bitte"} bestätige, dass diese Adresse dir gehört, damit sie für dein Kaneo-Konto verwendet werden kann. Der Link läuft in 24 Stunden ab.`,
    cta: "E-Mail bestätigen",
    fallback:
      "Schaltfläche funktioniert nicht? Füge diesen Link in deinen Browser ein:",
    noteTitle: "Nicht dein Konto?",
    note: "Dann kannst du diese E-Mail ignorieren. Es ändert sich nichts, solange niemand diesen Link öffnet.",
    footer: "Kaneo Konto-E-Mail",
  },
  vi: {
    preview: "Xác nhận địa chỉ email này thuộc về bạn.",
    title: "Xác nhận địa chỉ email",
    subtitle: (name?: string) =>
      `${name ? `Chào ${name}, hãy` : "Hãy"} xác nhận địa chỉ này thuộc về bạn để có thể dùng với tài khoản Kaneo. Liên kết hết hạn sau 24 giờ.`,
    cta: "Xác nhận email",
    fallback: "Nút không hoạt động? Dán liên kết này vào trình duyệt:",
    noteTitle: "Không phải tài khoản của bạn?",
    note: "Bạn có thể bỏ qua email này. Sẽ không có gì thay đổi trừ khi có người mở liên kết này.",
    footer: "Email tài khoản Kaneo",
  },
  ja: {
    preview: "このメールアドレスがあなたのものであることを確認してください。",
    title: "メールアドレスの確認",
    subtitle: (name?: string) =>
      `${name ? `${name} さん、` : ""}このアドレスを Kaneo アカウントで使用できるよう、あなたのものであることを確認してください。リンクは24時間で有効期限が切れます。`,
    cta: "メールアドレスを確認",
    fallback:
      "ボタンが機能しない場合は、このリンクをブラウザに貼り付けてください：",
    noteTitle: "心当たりがありませんか？",
    note: "このメールは無視してかまいません。誰かがこのリンクを開かない限り、何も変更されません。",
    footer: "Kaneo アカウントメール",
  },
  "zh-tw": {
    preview: "確認這個電子郵件地址屬於你。",
    title: "確認你的電子郵件地址",
    subtitle: (name?: string) =>
      `${name ? `${name} 你好，` : ""}請確認這個地址屬於你，以便用於你的 Kaneo 帳號。連結將在 24 小時後失效。`,
    cta: "確認電子郵件",
    fallback: "按鈕無法使用？請將此連結貼到瀏覽器：",
    noteTitle: "不是你的帳號？",
    note: "你可以忽略這封郵件。除非有人開啟此連結，否則不會有任何變更。",
    footer: "Kaneo 帳號通知",
  },
} as const;

const EmailVerificationEmail = ({
  verificationLink,
  userName,
  locale,
  email,
  instance,
}: EmailVerificationEmailProps) => {
  const emailLocale = resolveEmailLocale(locale);
  const copy = messages[emailLocale];

  return (
    <EmailShell
      title={copy.title}
      preview={copy.preview}
      lang={emailHtmlLang(emailLocale)}
    >
      <EmailIntro title={copy.title} subtitle={copy.subtitle(userName)} />
      <EmailButton href={verificationLink} icon="check-circle-light">
        {copy.cta}
      </EmailButton>
      <FallbackLink label={copy.fallback} href={verificationLink} />
      <EmailNote title={copy.noteTitle}>{copy.note}</EmailNote>
      <EmailFooter
        title={copy.footer}
        reason={
          email ? administratorReason[emailLocale](email, instance) : undefined
        }
        links={footerLinks(emailLocale)}
      />
    </EmailShell>
  );
};

EmailVerificationEmail.PreviewProps = {
  verificationLink:
    "https://cloud.kaneo.app/api/auth/verify-email?token=example",
  userName: "Maya",
  locale: "en-US",
  email: "maya@example.com",
  instance: "cloud.kaneo.app",
} as EmailVerificationEmailProps;

export default EmailVerificationEmail;
