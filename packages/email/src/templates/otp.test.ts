import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { OTP_EXPIRY_SECONDS } from "../otp-expiry";
import OtpEmail from "./otp";

describe("OtpEmail", () => {
  it("renders OTP and verification copy in HTML", async () => {
    const html = await render(createElement(OtpEmail, { otp: "123456" }));
    expect(html).toContain("123456");
    expect(html).toContain("verification code");
  });

  it.each([
    ["en-US", "This code expires in 5 minutes."],
    ["de-DE", "Dieser Code läuft in 5 Minuten ab."],
    ["vi-VN", "Mã này sẽ hết hạn sau 5 phút."],
    ["ja-JP", "このコードの有効期限は5分です。"],
  ])("describes the server expiry in %s", async (locale, expiry) => {
    expect(OTP_EXPIRY_SECONDS).toBe(300);
    const html = await render(
      createElement(OtpEmail, { otp: "123456", locale }),
    );
    expect(html).toContain(expiry);
    expect(html).not.toContain("15 minute");
  });
  it("renders Japanese copy for a Japanese locale", async () => {
    const html = await render(
      createElement(OtpEmail, { otp: "123456", locale: "ja-JP" }),
    );
    expect(html).toContain("確認コード");
    expect(html).toContain("Kaneo セキュリティメール");
  });
});
