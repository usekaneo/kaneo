import { createElement, type ComponentProps } from "react";
import { SendingDomainAttentionEmail } from "../../src/quills/templates/sending-domain-attention";

export default function Preview(
  props: ComponentProps<typeof SendingDomainAttentionEmail>,
) {
  return createElement(SendingDomainAttentionEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  domain: "support.acme.example",
  record: {
    purpose: "dkim",
    type: "CNAME",
    name: "mail._domainkey.support.acme.example",
    state: "missing",
  },
  settingsUrl: "https://app.quills.io/settings/email",
} satisfies ComponentProps<typeof SendingDomainAttentionEmail>;
