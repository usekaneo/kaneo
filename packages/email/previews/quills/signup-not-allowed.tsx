import { createElement, type ComponentProps } from "react";
import { SignupNotAllowedEmail } from "../../src/quills/templates/signup-not-allowed";

export default function Preview(
  props: ComponentProps<typeof SignupNotAllowedEmail>,
) {
  return createElement(SignupNotAllowedEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
} satisfies ComponentProps<typeof SignupNotAllowedEmail>;
