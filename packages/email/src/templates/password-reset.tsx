import React from "react";
import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { FallbackLink } from "../components/fallback-link";
import { footerLinks } from "../components/footer-links";
import {
  type RequestContext,
  RequestDetails,
} from "../components/request-details";
import { passwordResetReason } from "../components/security-reasons";
import { emailHtmlLang, resolveEmailLocale } from "./resolve-locale";

void React;

export type PasswordResetEmailProps = RequestContext & {
  resetLink: string;
  userName?: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview:
      "Use the link inside to choose a new password. It expires in 1 hour.",
    title: "Reset your password",
    subtitleWithName: (name: string) =>
      `Hi ${name}, use the button below to choose a new password. The link works once and expires in 1 hour.`,
    subtitleDefault:
      "Use the button below to choose a new password. The link works once and expires in 1 hour.",
    cta: "Reset password",
    fallback: "Button not working? Paste this link into your browser:",
    ignoreTitle: "Didn't ask for this?",
    ignore:
      "You can ignore this email. Your password stays the same until someone opens this link and sets a new one.",
    footer: "Kaneo security email",
  },
  de: {
    preview:
      "Über den Link darin wählst du ein neues Passwort. Er läuft in 1 Stunde ab.",
    title: "Passwort zurücksetzen",
    subtitleWithName: (name: string) =>
      `Hallo ${name}, verwende die Schaltfläche unten, um ein neues Passwort festzulegen. Der Link funktioniert nur einmal und läuft in 1 Stunde ab.`,
    subtitleDefault:
      "Verwende die Schaltfläche unten, um ein neues Passwort festzulegen. Der Link funktioniert nur einmal und läuft in 1 Stunde ab.",
    cta: "Passwort zurücksetzen",
    fallback:
      "Schaltfläche funktioniert nicht? Füge diesen Link in deinen Browser ein:",
    ignoreTitle: "Du hast das nicht angefordert?",
    ignore:
      "Dann kannst du diese E-Mail ignorieren. Dein Passwort bleibt gleich, bis jemand diesen Link öffnet und ein neues festlegt.",
    footer: "Kaneo Sicherheits-E-Mail",
  },
  vi: {
    preview:
      "Dùng liên kết bên trong để đặt mật khẩu mới. Liên kết hết hạn sau 1 giờ.",
    title: "Đặt lại mật khẩu",
    subtitleWithName: (name: string) =>
      `Chào ${name}, hãy dùng nút bên dưới để đặt mật khẩu mới. Liên kết chỉ dùng được một lần và hết hạn sau 1 giờ.`,
    subtitleDefault:
      "Hãy dùng nút bên dưới để đặt mật khẩu mới. Liên kết chỉ dùng được một lần và hết hạn sau 1 giờ.",
    cta: "Đặt lại mật khẩu",
    fallback: "Nút không hoạt động? Dán liên kết này vào trình duyệt:",
    ignoreTitle: "Bạn không yêu cầu điều này?",
    ignore:
      "Bạn có thể bỏ qua email này. Mật khẩu của bạn sẽ giữ nguyên cho đến khi có người mở liên kết này và đặt mật khẩu mới.",
    footer: "Email bảo mật Kaneo",
  },
  ja: {
    preview:
      "メール内のリンクから新しいパスワードを設定してください。有効期限は1時間です。",
    title: "パスワードのリセット",
    subtitleWithName: (name: string) =>
      `${name} さん、下のボタンから新しいパスワードを設定してください。リンクは1回のみ有効で、1時間で有効期限が切れます。`,
    subtitleDefault:
      "下のボタンから新しいパスワードを設定してください。リンクは1回のみ有効で、1時間で有効期限が切れます。",
    cta: "パスワードをリセット",
    fallback:
      "ボタンが機能しない場合は、このリンクをブラウザに貼り付けてください：",
    ignoreTitle: "心当たりがありませんか？",
    ignore:
      "このメールは無視してかまいません。誰かがこのリンクを開いて新しいパスワードを設定しない限り、パスワードは変更されません。",
    footer: "Kaneo セキュリティメール",
  },
  "zh-tw": {
    preview: "使用信中的連結設定新密碼。連結將在 1 小時後失效。",
    title: "重設密碼",
    subtitleWithName: (name: string) =>
      `${name} 你好，請點選下方按鈕設定新密碼。連結只能使用一次，並將在 1 小時後失效。`,
    subtitleDefault:
      "請點選下方按鈕設定新密碼。連結只能使用一次，並將在 1 小時後失效。",
    cta: "重設密碼",
    fallback: "按鈕無法使用？請將此連結貼到瀏覽器：",
    ignoreTitle: "沒有提出這項要求？",
    ignore:
      "你可以忽略這封郵件。在有人開啟此連結並設定新密碼之前，你的密碼都不會變更。",
    footer: "Kaneo 安全性通知",
  },
} as const;

const PasswordResetEmail = ({
  resetLink,
  userName,
  locale,
  email,
  instance,
  requestedAt,
  device,
}: PasswordResetEmailProps) => {
  const emailLocale = resolveEmailLocale(locale);
  const copy = messages[emailLocale];

  return (
    <EmailShell
      title={copy.title}
      preview={copy.preview}
      lang={emailHtmlLang(emailLocale)}
    >
      <EmailIntro
        title={copy.title}
        subtitle={
          userName ? copy.subtitleWithName(userName) : copy.subtitleDefault
        }
      />
      <EmailButton href={resetLink} icon="key-round-light">
        {copy.cta}
      </EmailButton>
      <FallbackLink label={copy.fallback} href={resetLink} />
      <RequestDetails
        locale={emailLocale}
        email={email}
        instance={instance}
        requestedAt={requestedAt}
        device={device}
      />
      <EmailNote title={copy.ignoreTitle}>{copy.ignore}</EmailNote>
      <EmailFooter
        title={copy.footer}
        reason={
          email ? passwordResetReason[emailLocale](email, instance) : undefined
        }
        links={footerLinks(emailLocale)}
      />
    </EmailShell>
  );
};

PasswordResetEmail.PreviewProps = {
  resetLink: "https://cloud.kaneo.app/auth/reset-password?token=example",
  userName: "Maya",
  locale: "en-US",
  email: "maya@example.com",
  instance: "cloud.kaneo.app",
  requestedAt: "2026-10-11T14:12:00.000Z",
  device: { browser: "Safari", os: "iPhone" },
} as PasswordResetEmailProps;

export default PasswordResetEmail;
