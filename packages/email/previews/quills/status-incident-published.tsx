import { createElement, type ComponentProps } from "react";
import { StatusIncidentPublishedEmail } from "../../src/quills/templates/status-incident-published";

export default function Preview(
  props: ComponentProps<typeof StatusIncidentPublishedEmail>,
) {
  return createElement(StatusIncidentPublishedEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  incidentTitle: "Delayed email notifications",
  impact: "minor",
  statusLabel: "Investigating",
  body: "Some email notifications are taking longer than usual.\nOur team is investigating and will share another update shortly.",
  affectedComponents: [
    {
      name: "Email notifications",
      status: "Degraded performance",
    },
  ],
  incidentUrl: "https://app.quills.io/status/notifications",
} satisfies ComponentProps<typeof StatusIncidentPublishedEmail>;
