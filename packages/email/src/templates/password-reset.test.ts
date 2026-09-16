import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
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
});
