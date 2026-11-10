import { createElement, type ComponentProps } from "react";
import { ConversationClosedEmail } from "../../src/quills/templates/conversation-closed";

export default function Preview(
  props: ComponentProps<typeof ConversationClosedEmail>,
) {
  return createElement(ConversationClosedEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  variant: "closed",
  viewUrl: "https://app.quills.io/conversations/128",
} satisfies ComponentProps<typeof ConversationClosedEmail>;
