import { createElement, type ComponentProps } from "react";
import { ChangelogPublishedEmail } from "../../src/quills/templates/changelog-published";

export default function Preview(
  props: ComponentProps<typeof ChangelogPublishedEmail>,
) {
  return createElement(ChangelogPublishedEmail, props);
}

Preview.PreviewProps = {
  organizationName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  changelogTitle: "A clearer view of your roadmap",
  changelogUrl: "https://app.quills.io/changelog/roadmap",
  contentPreview: "See what is planned, in progress, and ready for your team.",
  bodyHtml:
    "<p>See what is <strong>planned, in progress, and ready</strong> for your team.</p><ul><li>Filter updates by project.</li><li>Follow the work that matters to you.</li></ul>",
} satisfies ComponentProps<typeof ChangelogPublishedEmail>;
