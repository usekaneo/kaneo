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
import { signInReason } from "../components/security-reasons";
import { emailHtmlLang, resolveEmailLocale } from "./resolve-locale";

void React;

export type MagicLinkEmailProps = RequestContext & {
  magicLink: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview: "Use it to finish signing in. It expires in 5 minutes.",
    title: "Sign in to Kaneo",
    subtitle:
      "Use the button below to finish signing in. The link works once and expires in 5 minutes.",
    cta: "Sign in to Kaneo",
    fallback: "Button not working? Paste this link into your browser:",
    ignoreTitle: "Didn't try to sign in?",
    ignore:
      "You can ignore this email. Nobody can get into your account without opening this link. Kaneo will never ask you to forward it.",
    footer: "Kaneo security email",
  },
  de: {
    preview:
      "Damit schließt du die Anmeldung ab. Der Link läuft in 5 Minuten ab.",
    title: "Bei Kaneo anmelden",
    subtitle:
      "Verwende die Schaltfläche unten, um die Anmeldung abzuschließen. Der Link funktioniert nur einmal und läuft in 5 Minuten ab.",
    cta: "Bei Kaneo anmelden",
    fallback:
      "Schaltfläche funktioniert nicht? Füge diesen Link in deinen Browser ein:",
    ignoreTitle: "Du wolltest dich nicht anmelden?",
    ignore:
      "Dann kannst du diese E-Mail ignorieren. Ohne diesen Link kommt niemand in dein Konto. Kaneo wird dich nie bitten, ihn weiterzuleiten.",
    footer: "Kaneo Sicherheits-E-Mail",
  },
  vi: {
    preview:
      "Dùng liên kết này để hoàn tất đăng nhập. Liên kết hết hạn sau 5 phút.",
    title: "Đăng nhập vào Kaneo",
    subtitle:
      "Dùng nút bên dưới để hoàn tất đăng nhập. Liên kết chỉ dùng được một lần và hết hạn sau 5 phút.",
    cta: "Đăng nhập vào Kaneo",
    fallback: "Nút không hoạt động? Dán liên kết này vào trình duyệt:",
    ignoreTitle: "Bạn không định đăng nhập?",
    ignore:
      "Bạn có thể bỏ qua email này. Không ai có thể vào tài khoản của bạn nếu không mở liên kết này. Kaneo sẽ không bao giờ yêu cầu bạn chuyển tiếp liên kết.",
    footer: "Email bảo mật Kaneo",
  },
  ja: {
    preview: "サインインを完了するために使用してください。有効期限は5分です。",
    title: "Kaneo にサインイン",
    subtitle:
      "下のボタンからサインインを完了してください。リンクは1回のみ有効で、5分で有効期限が切れます。",
    cta: "Kaneo にサインイン",
    fallback:
      "ボタンが機能しない場合は、このリンクをブラウザに貼り付けてください：",
    ignoreTitle: "サインインしようとしていませんか？",
    ignore:
      "このメールは無視してかまいません。このリンクを開かなければ、誰もあなたのアカウントにアクセスできません。Kaneo がリンクの転送を求めることはありません。",
    footer: "Kaneo セキュリティメール",
  },
  "zh-tw": {
    preview: "用它來完成登入。連結將在 5 分鐘後失效。",
    title: "登入 Kaneo",
    subtitle: "點選下方按鈕以完成登入。連結只能使用一次，並將在 5 分鐘後失效。",
    cta: "登入 Kaneo",
    fallback: "按鈕無法使用？請將此連結貼到瀏覽器：",
    ignoreTitle: "沒有嘗試登入？",
    ignore:
      "你可以忽略這封郵件。沒有開啟此連結，任何人都無法進入你的帳號。Kaneo 絕不會要求你轉寄此連結。",
    footer: "Kaneo 安全性通知",
  },
} as const;

const MagicLinkEmail = ({
  magicLink,
  locale,
  email,
  instance,
  requestedAt,
  device,
}: MagicLinkEmailProps) => {
  const emailLocale = resolveEmailLocale(locale);
  const copy = messages[emailLocale];

  return (
    <EmailShell
      title={copy.title}
      preview={copy.preview}
      lang={emailHtmlLang(emailLocale)}
    >
      <EmailIntro title={copy.title} subtitle={copy.subtitle} />
      <EmailButton href={magicLink} icon="log-in-light">
        {copy.cta}
      </EmailButton>
      <FallbackLink label={copy.fallback} href={magicLink} />
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
        reason={email ? signInReason[emailLocale](email, instance) : undefined}
        links={footerLinks(emailLocale)}
      />
    </EmailShell>
  );
};

MagicLinkEmail.PreviewProps = {
  magicLink: "https://cloud.kaneo.app/api/auth/magic-link/verify?token=example",
  locale: "en-US",
  email: "maya@example.com",
  instance: "cloud.kaneo.app",
  requestedAt: "2026-10-11T14:12:00.000Z",
  device: { browser: "Safari", os: "iPhone" },
} as MagicLinkEmailProps;

export default MagicLinkEmail;
