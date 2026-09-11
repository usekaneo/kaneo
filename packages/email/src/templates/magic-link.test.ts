import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import MagicLinkEmail from "./magic-link";

describe("MagicLinkEmail", () => {
  it("renders Japanese copy for a Japanese locale", async () => {
    const html = await render(
      createElement(MagicLinkEmail, {
        magicLink: "https://kaneo.example/auth",
        locale: "ja-JP",
      }),
    );
    expect(html).toContain("Kaneo にサインイン");
    expect(html).toContain("Kaneo セキュリティメール");
  });
});
