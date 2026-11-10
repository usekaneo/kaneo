import { createElement, type ComponentProps } from "react";
import { ConversationReplyEmail } from "../../src/quills/templates/conversation-reply";

export default function Preview(
  props: ComponentProps<typeof ConversationReplyEmail>,
) {
  return createElement(ConversationReplyEmail, props);
}

Preview.PreviewProps = {
  messagePreview:
    "Hi Alex,\n\nYour workspace is ready. You can now invite your teammates and share your first roadmap.\n\nLet me know if you need a hand.",
  agentName: "Maya Chen",
  teamName: "Acme Support",
  viewUrl: "https://app.quills.io/conversations/128",
  quotedPrevious: {
    date: "2026-11-09T10:30:00Z",
    name: "Alex Morgan",
    text: "Can you help us get our workspace ready?",
  },
} satisfies ComponentProps<typeof ConversationReplyEmail>;
