import React from "react";
void React;
import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { TicketEventEmail } from "../templates/ticket-event";

const base = {
  heading: "New reply on your ticket",
  intro: 'Sarah replied to #142 "Export fails":',
  ctaUrl: "https://acme.example.com/support/ticket/ticket_1",
  ctaLabel: "View your ticket",
  organizationName: "Acme",
  reason: "You're receiving this because you opened ticket #142 at Acme.",
  preferencesUrl: "https://acme.example.com/settings/preferences",
};

describe("TicketEventEmail", () => {
  it("renders the full message body as paragraphs with the author attribution", async () => {
    const html = await render(
      <TicketEventEmail
        {...base}
        authorName="Sarah"
        messageBody={
          "First paragraph of the reply.\n\nSecond paragraph after a blank line."
        }
      />,
    );
    expect(html).toContain("First paragraph of the reply.");
    expect(html).toContain("Second paragraph after a blank line.");
    expect(html).toContain("Sarah");
    expect(html).toContain("View your ticket");
    expect(html).toContain("Manage notification preferences");
    expect(html).toContain("https://acme.example.com/settings/preferences");
  });

  it("escapes markup in the message body (plain-text rendering)", async () => {
    const html = await render(
      <TicketEventEmail
        {...base}
        messageBody={"<img src=x onerror=alert(1)> hello"}
      />,
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("hello");
  });

  it("renders the status transition only when present", async () => {
    const withChange = await render(
      <TicketEventEmail
        {...base}
        heading="Your ticket was resolved"
        statusChange={{ previousLabel: "In progress", newLabel: "Resolved" }}
      />,
    );
    expect(withChange).toContain("In progress");
    expect(withChange).toContain("Resolved");

    const without = await render(<TicketEventEmail {...base} />);
    expect(without).not.toContain("In progress");
  });

  it("renders the SLA fact line and note blocks when present", async () => {
    const html = await render(
      <TicketEventEmail
        {...base}
        heading="First response SLA approaching breach"
        factLine="First response due 14:30"
        note="Replying reopens the ticket."
      />,
    );
    expect(html).toContain("First response due 14:30");
    expect(html).toContain("Replying reopens the ticket.");
  });
});
