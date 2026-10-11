import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
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
    ["zh-TW", "此驗證碼將在 5 分鐘後失效。"],
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

  it("renders the request details in the recipient's language", async () => {
    const context = {
      otp: "482913",
      email: "maya@example.com",
      instance: "kaneo.example",
      requestedAt: new Date("2026-10-11T14:12:00Z"),
      device: { browser: "Safari", os: "iPhone" },
    };
    const english = await render(createElement(OtpEmail, context));
    expect(english).toContain("Request details");
    expect(english).toContain("Safari on iPhone");
    expect(english).toContain("Oct 11, 2026");
    expect(english).toContain("kaneo.example");

    const german = await render(
      createElement(OtpEmail, { ...context, locale: "de-DE" }),
    );
    expect(german).toContain("Safari auf iPhone");
  });

  it("hides the request details when nothing is known", async () => {
    const html = await render(createElement(OtpEmail, { otp: "482913" }));
    expect(html).not.toContain("Request details");
  });
});
