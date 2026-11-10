import { brandText } from "@kaneo/branding";
import { render } from "react-email";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import MagicLinkEmail from "./magic-link";

describe("MagicLinkEmail", () => {
  it("renders Japanese copy for a Japanese locale", async () => {
    const html = await render(
      createElement(MagicLinkEmail, {
        magicLink: "https://kaneo.example/auth",
        locale: "ja-JP",
      }),
    );
    expect(html).toContain(brandText("Kaneo にサインイン"));
    expect(html).toContain(brandText("Kaneo セキュリティメール"));
  });

  it("renders Traditional Chinese copy for a zh-TW locale", async () => {
    const html = await render(
      createElement(MagicLinkEmail, {
        magicLink: "https://kaneo.example/auth",
        locale: "zh-TW",
      }),
    );
    expect(html).toContain(brandText("登入 Kaneo"));
    expect(html).toContain(brandText("Kaneo 安全性通知"));
  });
});
