import React from "react";
void React;
import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { MagicLinkEmail } from "../templates/magic-link";

describe("MagicLinkEmail", () => {
  it("names the workspace being signed in to, in sentence case", async () => {
    const html = await render(
      <MagicLinkEmail
        signInUrl="https://acme.example/verify"
        code="123456"
        workspaceName="Acme"
      />,
    );
    expect(html).toMatch(/<h1[^>]*>Sign in to Acme<\/h1>/);
    expect(html).not.toContain("Sign in to Quackback");
  });

  it("says plain Sign in when the workspace has no name", async () => {
    const html = await render(
      <MagicLinkEmail signInUrl="https://x.example/v" code="123456" />,
    );
    expect(html).toMatch(/<h1[^>]*>Sign in<\/h1>/);
  });
});
