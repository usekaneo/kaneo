import type { AccountPasswordPurpose } from "@kaneo/email";

type Subjects = Record<AccountPasswordPurpose | "verification", string>;

const subjects = {
  en: {
    setup: "Set up your Kaneo account",
    reset: "Choose a new Kaneo password",
    verification: "Confirm your email address for Kaneo",
  },
  de: {
    setup: "Richte dein Kaneo-Konto ein",
    reset: "Lege ein neues Kaneo-Passwort fest",
    verification: "Bestätige deine E-Mail-Adresse für Kaneo",
  },
  vi: {
    setup: "Thiết lập tài khoản Kaneo",
    reset: "Đặt mật khẩu Kaneo mới",
    verification: "Xác nhận địa chỉ email cho Kaneo",
  },
  ja: {
    setup: "Kaneo アカウントの設定",
    reset: "Kaneo の新しいパスワードを設定",
    verification: "Kaneo のメールアドレスを確認",
  },
  "zh-tw": {
    setup: "設定你的 Kaneo 帳號",
    reset: "設定新的 Kaneo 密碼",
    verification: "確認你的 Kaneo 電子郵件地址",
  },
} satisfies Record<string, Subjects>;

export function accountEmailSubject(
  kind: keyof Subjects,
  locale: string | null,
) {
  const normalized = locale?.toLowerCase() ?? "";
  const key = normalized === "zh-tw" ? normalized : normalized.split("-")[0];
  const copy: Subjects =
    key && key in subjects
      ? subjects[key as keyof typeof subjects]
      : subjects.en;
  return copy[kind];
}
