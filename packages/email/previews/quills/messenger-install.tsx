import { createElement, type ComponentProps } from "react";
import { MessengerInstallEmail } from "../../src/quills/templates/messenger-install";

export default function Preview(
  props: ComponentProps<typeof MessengerInstallEmail>,
) {
  return createElement(MessengerInstallEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  senderName: "Maya Chen",
  snippet:
    '<script src="https://app.quills.io/messenger.js" data-workspace="acme" async></script>',
} satisfies ComponentProps<typeof MessengerInstallEmail>;
