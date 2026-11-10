import React from "react";
void React;
import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { PortalInviteEmail } from "../templates/portal-invite";

describe("PortalInviteEmail", () => {
  it("renders without a personal message when none is provided", async () => {
    const html = await render(
      <PortalInviteEmail
        workspaceName="Acme"
        inviteLink="https://example.com/accept/abc"
      />,
    );
    expect(html).toContain("You&#x27;ve been invited");
    expect(html).toContain("Acme");
    expect(html).not.toContain("From your inviter");
  });

  it("renders the personal message in a callout when provided", async () => {
    const html = await render(
      <PortalInviteEmail
        workspaceName="Acme"
        inviteLink="https://example.com/accept/abc"
        personalMessage="Hi Alice — looking forward to your feedback on the new beta!"
      />,
    );
    expect(html).toContain("Hi Alice");
    expect(html).toContain("looking forward to your feedback");
  });
});
