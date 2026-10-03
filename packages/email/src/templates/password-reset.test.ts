import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import PasswordResetEmail from "./password-reset";

describe("PasswordResetEmail", () => {
  it("renders Japanese copy for a Japanese locale", async () => {
    const html = await render(
      createElement(PasswordResetEmail, {
        resetLink: "https://kaneo.example/reset",
        locale: "ja-JP",
      }),
    );
    expect(html).toContain("パスワードのリセット");
    expect(html).toContain("Kaneo セキュリティメール");
  });

  it("renders Traditional Chinese copy for a zh-TW locale", async () => {
    const html = await render(
      createElement(PasswordResetEmail, {
        resetLink: "https://kaneo.example/reset",
        locale: "zh-TW",
      }),
    );
    expect(html).toContain("重設密碼");
    expect(html).toContain("Kaneo 安全性通知");
  });
});
