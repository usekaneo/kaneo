import React from "react";
void React;
/**
 * The message a workspace sends instead of a sign-in link when it will not open
 * an account for the address.
 *
 * It exists because the HTTP response deliberately cannot say so — an endpoint
 * that answered differently per address would be an account-existence oracle
 * for anyone who asked. The inbox is the substitute channel, so the one property
 * this template must have is that **it grants nothing**: no link, no code, no
 * token. That is what makes it safe to send to an address nobody has proven
 * they own, and it is what the assertions below are about.
 */
import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { SignupNotAllowedEmail } from "../templates/signup-not-allowed";
import { emailAsset } from "../../components/assets";

const BRAND_LOGO = "https://example.com/api/storage/logos/brand-logo.png";

describe("SignupNotAllowedEmail", () => {
  /** The words a reader sees, with the markup and the layout padding gone. */
  function visibleText(html: string): string {
    return html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/[^\x20-\x7e]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  it("carries no capability of any kind", async () => {
    const html = await render(SignupNotAllowedEmail({ workspaceName: "Acme" }));

    // No anchor at all: nothing to click, so nothing to consume, so nothing an
    // interceptor of this mail could redeem.
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/token=/i);
    // And no code to type. The sign-in mail's whole payload is a six-digit one,
    // so this is the assertion that separates the two templates.
    expect(visibleText(html)).not.toMatch(/\d{4,}/);
  });

  // Read against the sibling it stands in for: whatever the sign-in mail offers,
  // this one must not. Written as a comparison so a future change that adds a
  // link or a code to this template fails here rather than shipping quietly.
  it("offers strictly less than the sign-in mail it replaces", async () => {
    const { MagicLinkEmail } = await import("../templates/magic-link");
    const signIn = await render(
      MagicLinkEmail({
        signInUrl: "https://acme.example/verify?token=abc",
        code: "123456",
      }),
    );
    const refusal = await render(
      SignupNotAllowedEmail({ workspaceName: "Acme" }),
    );

    expect(signIn).toMatch(/<a\b/i);
    expect(visibleText(signIn)).toMatch(/123456/);
    expect(refusal).not.toMatch(/<a\b/i);
    expect(visibleText(refusal)).not.toMatch(/\d{4,}/);
  });

  it("says what to do next rather than only that something failed", async () => {
    const html = await render(SignupNotAllowedEmail({ workspaceName: "Acme" }));

    expect(html).toMatch(/not accepting new accounts/i);
    expect(html).toMatch(/invite/i);
  });

  it("names the workspace when it knows it, and stays readable when it does not", async () => {
    expect(
      await render(SignupNotAllowedEmail({ workspaceName: "Acme" })),
    ).toContain("Acme");
    const anonymous = await render(SignupNotAllowedEmail({}));
    expect(anonymous).toMatch(/this workspace/i);
    expect(anonymous).not.toContain("undefined");
  });

  it("renders the brand logo when the workspace has one", async () => {
    const html = await render(
      SignupNotAllowedEmail({ workspaceName: "Acme", logoUrl: BRAND_LOGO }),
    );

    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
  });
});
