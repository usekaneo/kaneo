import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import OtpEmail from "./otp";

describe("OtpEmail", () => {
  it("renders OTP and verification copy in HTML", async () => {
    const html = await render(createElement(OtpEmail, { otp: "123456" }));
    expect(html).toContain("123456");
    expect(html).toContain("verification code");
  });

  it("renders Japanese copy for a Japanese locale", async () => {
    const html = await render(
      createElement(OtpEmail, { otp: "123456", locale: "ja-JP" }),
    );
    expect(html).toContain("確認コード");
    expect(html).toContain("Kaneo セキュリティメール");
  });
});
