import { createElement, type ComponentProps } from "react";
import { RecoveryCodeUsedEmail } from "../../src/quills/templates/recovery-code-used";

export default function Preview(
  props: ComponentProps<typeof RecoveryCodeUsedEmail>,
) {
  return createElement(RecoveryCodeUsedEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  occurredAt: "November 9, 2026 at 10:30 AM EST",
  ipAddress: "192.0.2.10",
  userAgent: "Safari on macOS",
} satisfies ComponentProps<typeof RecoveryCodeUsedEmail>;
