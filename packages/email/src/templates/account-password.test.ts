import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import AccountPasswordEmail from "./account-password";

const link = "https://kaneo.example/api/auth/reset-password/abc";

describe("AccountPasswordEmail", () => {
  it("invites a new account to set a password instead of resetting one", async () => {
    const html = await render(
      createElement(AccountPasswordEmail, {
        purpose: "setup",
        passwordLink: link,
        userName: "Maya",
        email: "maya@example.com",
        instance: "kaneo.example",
      }),
    );
    expect(html).toContain("Set up your Kaneo account");
    expect(html).toContain("expires in 2 days");
    expect(html).toContain("an administrator of kaneo.example");
    expect(html).not.toContain("Reset");
    expect(html).toContain(link);
  });

  it("explains an administrator-sent reset link in German", async () => {
    const html = await render(
      createElement(AccountPasswordEmail, {
        purpose: "reset",
        passwordLink: link,
        locale: "de-DE",
      }),
    );
    expect(html).toContain("Neues Passwort festlegen");
    expect(html).toContain("1 Stunde");
  });
});
