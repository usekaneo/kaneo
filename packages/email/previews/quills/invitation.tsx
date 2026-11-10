import { createElement, type ComponentProps } from "react";
import { InvitationEmail } from "../../src/quills/templates/invitation";

export default function Preview(props: ComponentProps<typeof InvitationEmail>) {
  return createElement(InvitationEmail, props);
}

Preview.PreviewProps = {
  organizationName: "Acme",
  invitedByName: "Maya Chen",
  inviteeName: "Alex",
  inviteLink: "https://app.quills.io/invite/preview",
} satisfies ComponentProps<typeof InvitationEmail>;
