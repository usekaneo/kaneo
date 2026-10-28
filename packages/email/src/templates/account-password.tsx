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

/**
 * `setup`: an administrator created the account and the person chooses their
 * first password. `reset`: an administrator sent a link to choose a new one.
 */
export type AccountPasswordPurpose = "setup" | "reset";

export type AccountPasswordEmailProps = {
  purpose: AccountPasswordPurpose;
  passwordLink: string;
  userName?: string;
  locale?: string | null;
  email?: string;
  instance?: string;
};

type Copy = {
  preview: string;
  title: string;
  subtitle: (name?: string) => string;
  cta: string;
  noteTitle: string;
  note: string;
};

const fallback = {
  en: "Button not working? Paste this link into your browser:",
  de: "Schaltfläche funktioniert nicht? Füge diesen Link in deinen Browser ein:",
  vi: "Nút không hoạt động? Dán liên kết này vào trình duyệt:",
  ja: "ボタンが機能しない場合は、このリンクをブラウザに貼り付けてください：",
  "zh-tw": "按鈕無法使用？請將此連結貼到瀏覽器：",
} as const;

const footer = {
  en: "Kaneo account email",
  de: "Kaneo Konto-E-Mail",
  vi: "Email tài khoản Kaneo",
  ja: "Kaneo アカウントメール",
  "zh-tw": "Kaneo 帳號通知",
} as const;

const setup: Record<keyof typeof fallback, Copy> = {
  en: {
    preview:
      "An administrator created a Kaneo account for you. Choose a password to sign in.",
    title: "Set up your Kaneo account",
    subtitle: (name) =>
      `${name ? `Hi ${name}, an` : "An"} administrator created a Kaneo account for you. Choose a password to sign in. The link works once and expires in 2 days.`,
    cta: "Set password",
    noteTitle: "Not expecting this?",
    note: "You can ignore this email. No password is set until someone opens this link and chooses one.",
  },
  de: {
    preview:
      "Eine Administratorin oder ein Administrator hat ein Kaneo-Konto für dich angelegt. Lege ein Passwort fest, um dich anzumelden.",
    title: "Richte dein Kaneo-Konto ein",
    subtitle: (name) =>
      `${name ? `Hallo ${name}, eine` : "Eine"} Administratorin oder ein Administrator hat ein Kaneo-Konto für dich angelegt. Lege ein Passwort fest, um dich anzumelden. Der Link funktioniert nur einmal und läuft in 2 Tagen ab.`,
    cta: "Passwort festlegen",
    noteTitle: "Hast du das nicht erwartet?",
    note: "Dann kannst du diese E-Mail ignorieren. Es wird kein Passwort festgelegt, bis jemand diesen Link öffnet und eines wählt.",
  },
  vi: {
    preview:
      "Quản trị viên đã tạo tài khoản Kaneo cho bạn. Hãy đặt mật khẩu để đăng nhập.",
    title: "Thiết lập tài khoản Kaneo",
    subtitle: (name) =>
      `${name ? `Chào ${name}, quản` : "Quản"} trị viên đã tạo tài khoản Kaneo cho bạn. Hãy đặt mật khẩu để đăng nhập. Liên kết chỉ dùng được một lần và hết hạn sau 2 ngày.`,
    cta: "Đặt mật khẩu",
    noteTitle: "Bạn không mong đợi email này?",
    note: "Bạn có thể bỏ qua email này. Sẽ không có mật khẩu nào được đặt cho đến khi có người mở liên kết này và chọn mật khẩu.",
  },
  ja: {
    preview:
      "管理者があなたの Kaneo アカウントを作成しました。パスワードを設定してサインインしてください。",
    title: "Kaneo アカウントの設定",
    subtitle: (name) =>
      `${name ? `${name} さん、` : ""}管理者があなたの Kaneo アカウントを作成しました。パスワードを設定してサインインしてください。リンクは1回のみ有効で、2日で有効期限が切れます。`,
    cta: "パスワードを設定",
    noteTitle: "心当たりがありませんか？",
    note: "このメールは無視してかまいません。誰かがこのリンクを開いてパスワードを設定しない限り、パスワードは設定されません。",
  },
  "zh-tw": {
    preview: "管理員已為你建立 Kaneo 帳號。請設定密碼以登入。",
    title: "設定你的 Kaneo 帳號",
    subtitle: (name) =>
      `${name ? `${name} 你好，` : ""}管理員已為你建立 Kaneo 帳號。請設定密碼以登入。連結只能使用一次，並將在 2 天後失效。`,
    cta: "設定密碼",
    noteTitle: "沒有預期收到這封郵件？",
    note: "你可以忽略這封郵件。在有人開啟此連結並設定密碼之前，不會設定任何密碼。",
  },
};

const reset: Record<keyof typeof fallback, Copy> = {
  en: {
    preview:
      "An administrator sent you a link to choose a new password. It expires in 1 hour.",
    title: "Choose a new password",
    subtitle: (name) =>
      `${name ? `Hi ${name}, an` : "An"} administrator sent you a link to choose a new Kaneo password. The link works once and expires in 1 hour.`,
    cta: "Choose new password",
    noteTitle: "Don't need a new password?",
    note: "You can ignore this email. Your password stays the same until someone opens this link and sets a new one.",
  },
  de: {
    preview:
      "Eine Administratorin oder ein Administrator hat dir einen Link für ein neues Passwort geschickt. Er läuft in 1 Stunde ab.",
    title: "Neues Passwort festlegen",
    subtitle: (name) =>
      `${name ? `Hallo ${name}, eine` : "Eine"} Administratorin oder ein Administrator hat dir einen Link geschickt, mit dem du ein neues Kaneo-Passwort festlegst. Der Link funktioniert nur einmal und läuft in 1 Stunde ab.`,
    cta: "Neues Passwort festlegen",
    noteTitle: "Brauchst du kein neues Passwort?",
    note: "Dann kannst du diese E-Mail ignorieren. Dein Passwort bleibt gleich, bis jemand diesen Link öffnet und ein neues festlegt.",
  },
  vi: {
    preview:
      "Quản trị viên đã gửi cho bạn liên kết để đặt mật khẩu mới. Liên kết hết hạn sau 1 giờ.",
    title: "Đặt mật khẩu mới",
    subtitle: (name) =>
      `${name ? `Chào ${name}, quản` : "Quản"} trị viên đã gửi cho bạn liên kết để đặt mật khẩu Kaneo mới. Liên kết chỉ dùng được một lần và hết hạn sau 1 giờ.`,
    cta: "Đặt mật khẩu mới",
    noteTitle: "Bạn không cần mật khẩu mới?",
    note: "Bạn có thể bỏ qua email này. Mật khẩu của bạn sẽ giữ nguyên cho đến khi có người mở liên kết này và đặt mật khẩu mới.",
  },
  ja: {
    preview:
      "管理者から新しいパスワードを設定するためのリンクが届きました。有効期限は1時間です。",
    title: "新しいパスワードの設定",
    subtitle: (name) =>
      `${name ? `${name} さん、` : ""}管理者から Kaneo の新しいパスワードを設定するためのリンクが届きました。リンクは1回のみ有効で、1時間で有効期限が切れます。`,
    cta: "新しいパスワードを設定",
    noteTitle: "新しいパスワードが不要な場合",
    note: "このメールは無視してかまいません。誰かがこのリンクを開いて新しいパスワードを設定しない限り、パスワードは変更されません。",
  },
  "zh-tw": {
    preview: "管理員寄給你設定新密碼的連結。連結將在 1 小時後失效。",
    title: "設定新密碼",
    subtitle: (name) =>
      `${name ? `${name} 你好，` : ""}管理員寄給你設定新 Kaneo 密碼的連結。連結只能使用一次，並將在 1 小時後失效。`,
    cta: "設定新密碼",
    noteTitle: "不需要新密碼？",
    note: "你可以忽略這封郵件。在有人開啟此連結並設定新密碼之前，你的密碼都不會變更。",
  },
};

const AccountPasswordEmail = ({
  purpose,
  passwordLink,
  userName,
  locale,
  email,
  instance,
}: AccountPasswordEmailProps) => {
  const emailLocale = resolveEmailLocale(locale);
  const copy = (purpose === "setup" ? setup : reset)[emailLocale];

  return (
    <EmailShell
      title={copy.title}
      preview={copy.preview}
      lang={emailHtmlLang(emailLocale)}
    >
      <EmailIntro title={copy.title} subtitle={copy.subtitle(userName)} />
      <EmailButton href={passwordLink} icon="key-round-light">
        {copy.cta}
      </EmailButton>
      <FallbackLink label={fallback[emailLocale]} href={passwordLink} />
      <EmailNote title={copy.noteTitle}>{copy.note}</EmailNote>
      <EmailFooter
        title={footer[emailLocale]}
        reason={
          email ? administratorReason[emailLocale](email, instance) : undefined
        }
        links={footerLinks(emailLocale)}
      />
    </EmailShell>
  );
};

AccountPasswordEmail.PreviewProps = {
  purpose: "setup",
  passwordLink: "https://cloud.kaneo.app/auth/reset-password?token=example",
  userName: "Maya",
  locale: "en-US",
  email: "maya@example.com",
  instance: "cloud.kaneo.app",
} as AccountPasswordEmailProps;

export default AccountPasswordEmail;
