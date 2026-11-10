import { createElement, type ComponentProps } from "react";
import { StatusChangeEmail } from "../../src/quills/templates/status-change";

export default function Preview(
  props: ComponentProps<typeof StatusChangeEmail>,
) {
  return createElement(StatusChangeEmail, props);
}

Preview.PreviewProps = {
  organizationName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  postTitle: "Add calendar subscriptions",
  postUrl: "https://app.quills.io/feedback/calendar-subscriptions",
  previousStatus: "planned",
  newStatus: "in_progress",
} satisfies ComponentProps<typeof StatusChangeEmail>;
