import { createElement, type ComponentProps } from "react";
import { NewCommentEmail } from "../../src/quills/templates/new-comment";

export default function Preview(props: ComponentProps<typeof NewCommentEmail>) {
  return createElement(NewCommentEmail, props);
}

Preview.PreviewProps = {
  organizationName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  postTitle: "Add calendar subscriptions",
  postUrl: "https://app.quills.io/feedback/calendar-subscriptions",
  commenterName: "Maya Chen",
  commentPreview:
    "We are starting work on calendar subscriptions this week. Thank you for sharing how your team would use them.",
  isTeamMember: true,
} satisfies ComponentProps<typeof NewCommentEmail>;
