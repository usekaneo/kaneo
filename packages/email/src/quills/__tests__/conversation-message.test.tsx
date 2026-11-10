import React from "react";
void React;
import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { ConversationMessageEmail } from "../templates/conversation-message";

const base = {
  heading: "New reply from Acme",
  intro: "An agent replied to your conversation.",
  senderName: "Agent Smith",
  messagePreview: "Short preview excerpt",
  ctaUrl: "https://acme.example.com/support/conversation_1",
  ctaLabel: "View conversation",
  organizationName: "Acme",
  reason: "You have an open conversation with this team.",
};

describe("ConversationMessageEmail", () => {
  it("renders the full bodyHtml inline in place of the preview quote", async () => {
    const html = await render(
      <ConversationMessageEmail
        {...base}
        bodyHtml="<p>Here is the <strong>whole</strong> answer.</p>"
      />,
    );
    // The rich body is embedded verbatim …
    expect(html).toContain("Here is the <strong>whole</strong> answer.");
    expect(html).toMatch(/<div[^>]*class="k-text-85"[^>]*><p>Here is the/);
    // … and the truncated preview quote is NOT shown.
    expect(html).not.toContain("Short preview excerpt");
    // CTA is preserved.
    expect(html).toContain("View conversation");
    expect(html).toContain("https://acme.example.com/support/conversation_1");
  });

  it("falls back to the messagePreview when bodyHtml is absent, without italic quote styling", async () => {
    const html = await render(<ConversationMessageEmail {...base} />);
    expect(html).toContain("Short preview excerpt");
    expect(html).not.toContain("font-style:italic");
    expect(html).toContain("View conversation");
  });

  it("uses a text-weight CTA and does not offer unsubscribe", async () => {
    const html = await render(<ConversationMessageEmail {...base} />);
    expect(html).toContain("View conversation");
    expect(html).not.toContain("Unsubscribe from this post");
    expect(html.toLowerCase()).not.toContain("<button");
  });
});
