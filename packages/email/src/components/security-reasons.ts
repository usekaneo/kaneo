import type { EmailLocale } from "../templates/resolve-locale";

type Reason = (email: string, instance?: string) => string;

export const signInReason: Record<EmailLocale, Reason> = {
  en: (email, instance = "Kaneo") =>
    `Sent to ${email} because someone asked to sign in to ${instance}.`,
  de: (email, instance = "Kaneo") =>
    `Gesendet an ${email}, weil jemand eine Anmeldung bei ${instance} angefordert hat.`,
  vi: (email, instance = "Kaneo") =>
    `Đã gửi đến ${email} vì có người yêu cầu đăng nhập vào ${instance}.`,
  ja: (email, instance = "Kaneo") =>
    `${instance} へのサインインがリクエストされたため、${email} に送信しました。`,
  "zh-tw": (email, instance = "Kaneo") =>
    `因為有人要求登入 ${instance}，所以寄送至 ${email}。`,
};

export const passwordResetReason: Record<EmailLocale, Reason> = {
  en: (email, instance = "Kaneo") =>
    `Sent to ${email} because someone asked to reset the password on ${instance}.`,
  de: (email, instance = "Kaneo") =>
    `Gesendet an ${email}, weil jemand bei ${instance} das Zurücksetzen des Passworts angefordert hat.`,
  vi: (email, instance = "Kaneo") =>
    `Đã gửi đến ${email} vì có người yêu cầu đặt lại mật khẩu trên ${instance}.`,
  ja: (email, instance = "Kaneo") =>
    `${instance} でパスワードのリセットがリクエストされたため、${email} に送信しました。`,
  "zh-tw": (email, instance = "Kaneo") =>
    `因為有人要求在 ${instance} 重設密碼，所以寄送至 ${email}。`,
};
