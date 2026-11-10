import { brandText } from "@kaneo/branding";
import type { EmailLocale } from "../templates/resolve-locale";

type Reason = (email: string, instance?: string) => string;

export const signInReason: Record<EmailLocale, Reason> = {
  en: (email, instance = brandText("Kaneo")) =>
    `Sent to ${email} because someone asked to sign in to ${instance}.`,
  de: (email, instance = brandText("Kaneo")) =>
    `Gesendet an ${email}, weil jemand eine Anmeldung bei ${instance} angefordert hat.`,
  vi: (email, instance = brandText("Kaneo")) =>
    `Đã gửi đến ${email} vì có người yêu cầu đăng nhập vào ${instance}.`,
  ja: (email, instance = brandText("Kaneo")) =>
    `${instance} へのサインインがリクエストされたため、${email} に送信しました。`,
  "zh-tw": (email, instance = brandText("Kaneo")) =>
    `因為有人要求登入 ${instance}，所以寄送至 ${email}。`,
};

export const signUpReason: Record<EmailLocale, Reason> = {
  en: (email, instance = brandText("Kaneo")) =>
    `Sent to ${email} because someone created an account on ${instance} with this address.`,
  de: (email, instance = brandText("Kaneo")) =>
    `Gesendet an ${email}, weil jemand mit dieser Adresse ein Konto bei ${instance} erstellt hat.`,
  vi: (email, instance = brandText("Kaneo")) =>
    `Đã gửi đến ${email} vì có người đã tạo tài khoản trên ${instance} bằng địa chỉ này.`,
  ja: (email, instance = brandText("Kaneo")) =>
    `このアドレスで ${instance} のアカウントが作成されたため、${email} に送信しました。`,
  "zh-tw": (email, instance = brandText("Kaneo")) =>
    `因為有人使用這個地址在 ${instance} 建立了帳號，所以寄送至 ${email}。`,
};

export const passwordResetReason: Record<EmailLocale, Reason> = {
  en: (email, instance = brandText("Kaneo")) =>
    `Sent to ${email} because someone asked to reset the password on ${instance}.`,
  de: (email, instance = brandText("Kaneo")) =>
    `Gesendet an ${email}, weil jemand bei ${instance} das Zurücksetzen des Passworts angefordert hat.`,
  vi: (email, instance = brandText("Kaneo")) =>
    `Đã gửi đến ${email} vì có người yêu cầu đặt lại mật khẩu trên ${instance}.`,
  ja: (email, instance = brandText("Kaneo")) =>
    `${instance} でパスワードのリセットがリクエストされたため、${email} に送信しました。`,
  "zh-tw": (email, instance = brandText("Kaneo")) =>
    `因為有人要求在 ${instance} 重設密碼，所以寄送至 ${email}。`,
};

export const administratorReason: Record<EmailLocale, Reason> = {
  en: (email, instance = brandText("Kaneo")) =>
    `Sent to ${email} because an administrator of ${instance}${brandText(" asked Kaneo to send it.")}`,
  de: (email, instance = brandText("Kaneo")) =>
    `Gesendet an ${email}, weil eine Administratorin oder ein Administrator von ${instance} diese E-Mail angefordert hat.`,
  vi: (email, instance = brandText("Kaneo")) =>
    `Đã gửi đến ${email} vì quản trị viên của ${instance}${brandText(" đã yêu cầu Kaneo gửi email này.")}`,
  ja: (email, instance = brandText("Kaneo")) =>
    `${instance} の管理者がこのメールの送信をリクエストしたため、${email} に送信しました。`,
  "zh-tw": (email, instance = brandText("Kaneo")) =>
    `因為 ${instance}${brandText(" 的管理員要求 Kaneo 寄送這封郵件，所以寄送至 ")}${email}。`,
};
