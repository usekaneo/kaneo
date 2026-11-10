import { createElement, type ComponentProps } from "react";
import { StatusMaintenanceScheduledEmail } from "../../src/quills/templates/status-maintenance-scheduled";

export default function Preview(
  props: ComponentProps<typeof StatusMaintenanceScheduledEmail>,
) {
  return createElement(StatusMaintenanceScheduledEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  preferencesUrl: "https://app.quills.io/settings/notifications",
  maintenanceTitle: "Scheduled database maintenance",
  body: "We are upgrading our database to improve reliability.\nYou may notice brief interruptions during this window.",
  startLabel: "November 12, 2026 at 02:00 UTC",
  endLabel: "November 12, 2026 at 03:00 UTC",
  affectedComponents: ["Dashboard", "API"],
  incidentUrl: "https://app.quills.io/status/maintenance",
} satisfies ComponentProps<typeof StatusMaintenanceScheduledEmail>;
