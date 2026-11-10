import { createElement, type ComponentProps } from "react";
import { PasswordResetEmail } from "../../src/quills/templates/password-reset";

export default function Preview(
  props: ComponentProps<typeof PasswordResetEmail>,
) {
  return createElement(PasswordResetEmail, props);
}

Preview.PreviewProps = {
  resetLink: "https://app.quills.io/reset-password/preview",
} satisfies ComponentProps<typeof PasswordResetEmail>;
