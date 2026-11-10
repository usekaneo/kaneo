import { createElement, type ComponentProps } from "react";
import { VerifyAddressEmail } from "../../src/quills/templates/verify-address";

export default function Preview(
  props: ComponentProps<typeof VerifyAddressEmail>,
) {
  return createElement(VerifyAddressEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  code: "482913",
} satisfies ComponentProps<typeof VerifyAddressEmail>;
