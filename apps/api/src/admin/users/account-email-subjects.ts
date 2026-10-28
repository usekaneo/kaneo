import type { AccountPasswordPurpose } from "@kaneo/email";

type Subjects = Record<AccountPasswordPurpose | "verification", string>;

const subjects = {
  en: {
    setup: "Set up your {{instanceName}} account",
    reset: "Choose a new {{instanceName}} password",
    verification: "Confirm your email address for {{instanceName}}",
  },
  de: {
    setup: "Richte dein {{instanceName}}-Konto ein",
    reset: "Lege ein neues {{instanceName}}-Passwort fest",
    verification: "Bestätige deine E-Mail-Adresse für {{instanceName}}",
  },
  vi: {
    setup: "Thiết lập tài khoản {{instanceName}}",
    reset: "Đặt mật khẩu {{instanceName}} mới",
    verification: "Xác nhận địa chỉ email cho {{instanceName}}",
  },
  ja: {
    setup: "{{instanceName}} アカウントの設定",
    reset: "{{instanceName}} の新しいパスワードを設定",
    verification: "{{instanceName}} のメールアドレスを確認",
  },
  "zh-tw": {
    setup: "設定你的 {{instanceName}} 帳號",
    reset: "設定新的 {{instanceName}} 密碼",
    verification: "確認你的 {{instanceName}} 電子郵件地址",
  },
} satisfies Record<string, Subjects>;

export function accountEmailSubject(
  kind: keyof Subjects,
  locale: string | null,
  instanceName = "Kaneo",
) {
  const normalized = locale?.toLowerCase() ?? "";
  const key = normalized === "zh-tw" ? normalized : normalized.split("-")[0];
  const copy: Subjects =
    key && key in subjects
      ? subjects[key as keyof typeof subjects]
      : subjects.en;
  return copy[kind].replace("{{instanceName}}", () => instanceName);
}
