import { createElement, type ComponentProps } from "react";
import { TicketEventEmail } from "../../src/quills/templates/ticket-event";

export default function Preview(
  props: ComponentProps<typeof TicketEventEmail>,
) {
  return createElement(TicketEventEmail, props);
}

Preview.PreviewProps = {
  organizationName: "Acme",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  heading: "Your ticket is now in progress",
  intro: "Maya started working on your request.",
  statusChange: {
    previousLabel: "Open",
    newLabel: "In progress",
  },
  ctaUrl: "https://app.quills.io/tickets/128",
  ctaLabel: "View ticket",
  reason: "You are following this ticket.",
} satisfies ComponentProps<typeof TicketEventEmail>;
