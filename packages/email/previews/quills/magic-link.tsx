import { createElement, type ComponentProps } from "react";
import { MagicLinkEmail } from "../../src/quills/templates/magic-link";

export default function Preview(props: ComponentProps<typeof MagicLinkEmail>) {
  return createElement(MagicLinkEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  signInUrl: "https://app.quills.io/sign-in/preview",
  code: "482913",
} satisfies ComponentProps<typeof MagicLinkEmail>;
