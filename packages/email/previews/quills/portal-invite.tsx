import { createElement, type ComponentProps } from "react";
import { PortalInviteEmail } from "../../src/quills/templates/portal-invite";

export default function Preview(
  props: ComponentProps<typeof PortalInviteEmail>,
) {
  return createElement(PortalInviteEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  inviteLink: "https://app.quills.io/portal/invite/preview",
  personalMessage: "We would love your feedback on the next release.",
} satisfies ComponentProps<typeof PortalInviteEmail>;
