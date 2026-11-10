import { createElement, type ComponentProps } from "react";
import { ConversationMessageEmail } from "../../src/quills/templates/conversation-message";

export default function Preview(
  props: ComponentProps<typeof ConversationMessageEmail>,
) {
  return createElement(ConversationMessageEmail, props);
}

Preview.PreviewProps = {
  organizationName: "Acme",
  heading: "A new reply from your team",
  intro: "Maya replied to your conversation.",
  senderName: "Maya Chen",
  messagePreview:
    "Thanks for the details. We have enabled the new workspace settings for your team.",
  bodyHtml:
    "<p>Thanks for the details. We have enabled the <strong>new workspace settings</strong> for your team.</p><p>You can try them now and reply with any questions.</p>",
  ctaUrl: "https://app.quills.io/conversations/128",
  ctaLabel: "View conversation",
  reason: "You are receiving this because you are part of this conversation.",
} satisfies ComponentProps<typeof ConversationMessageEmail>;
