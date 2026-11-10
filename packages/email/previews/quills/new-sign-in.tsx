import { createElement, type ComponentProps } from "react";
import { NewSignInEmail } from "../../src/quills/templates/new-sign-in";

export default function Preview(props: ComponentProps<typeof NewSignInEmail>) {
  return createElement(NewSignInEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  occurredAt: "November 9, 2026 at 10:30 AM EST",
  ipAddress: "192.0.2.10",
  userAgent: "Safari on macOS",
  location: "New York, United States",
  settingsUrl: "https://app.quills.io/settings/security",
} satisfies ComponentProps<typeof NewSignInEmail>;
