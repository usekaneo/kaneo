import { createElement, type ComponentProps } from "react";
import { NoteMentionEmail } from "../../src/quills/templates/note-mention";

export default function Preview(
  props: ComponentProps<typeof NoteMentionEmail>,
) {
  return createElement(NoteMentionEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  authorName: "Maya Chen",
  preview:
    "Alex, could you check the customer’s requested launch date?\nWe should confirm the rollout before Friday.",
  conversationUrl: "https://app.quills.io/conversations/128",
} satisfies ComponentProps<typeof NoteMentionEmail>;
