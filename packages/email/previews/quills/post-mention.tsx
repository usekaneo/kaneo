import { createElement, type ComponentProps } from "react";
import { PostMentionEmail } from "../../src/quills/templates/post-mention";

export default function Preview(
  props: ComponentProps<typeof PostMentionEmail>,
) {
  return createElement(PostMentionEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  mentionerName: "Maya Chen",
  postTitle: "Add calendar subscriptions",
  excerpt: "Alex, does a weekly calendar sync cover what your team needs?",
  postUrl: "https://app.quills.io/feedback/calendar-subscriptions",
} satisfies ComponentProps<typeof PostMentionEmail>;
