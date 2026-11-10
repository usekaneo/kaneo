import { createElement, type ComponentProps } from "react";
import { FeedbackLinkedEmail } from "../../src/quills/templates/feedback-linked";

export default function Preview(
  props: ComponentProps<typeof FeedbackLinkedEmail>,
) {
  return createElement(FeedbackLinkedEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  recipientName: "Alex",
  postTitle: "Add calendar subscriptions",
  postUrl: "https://app.quills.io/feedback/calendar-subscriptions",
  attributedByName: "Maya",
} satisfies ComponentProps<typeof FeedbackLinkedEmail>;
