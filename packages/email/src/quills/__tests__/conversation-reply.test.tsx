import React from "react";
void React;
import { describe, expect, it } from "vite-plus/test";
import { render } from "@react-email/components";
import { ConversationReplyEmail } from "../templates/conversation-reply";

describe("ConversationReplyEmail", () => {
  it("renders the body, signature, reply footer, and one-level quote", async () => {
    const html = await render(
      <ConversationReplyEmail
        bodyHtml="<p>I checked invoice #1042.</p>"
        messagePreview="I checked invoice #1042."
        agentName="Alex"
        teamName="Acme"
        viewUrl="https://acme.example.com/support/conversation_1"
        quotedPrevious={{
          date: new Date("2026-08-16T09:00:00Z"),
          name: "Priya Sharma",
          text: "Hi, I think we were charged twice",
        }}
      />,
    );

    expect(html).toContain("I checked invoice #1042.");
    expect(html).toContain("Alex");
    expect(html).toContain("Acme");
    expect(html).toContain("Reply to this email to continue the conversation");
    expect(html).toContain("View it online");
    expect(html).toContain("Priya Sharma");
    expect(html).toContain("wrote:");
    expect(html).toContain("Hi, I think we were charged twice");
    expect(html).not.toContain("Unsubscribe");
    expect(html).not.toContain("New reply from");
  });
});
