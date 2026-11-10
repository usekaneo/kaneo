import { createElement, type ComponentProps } from "react";
import { WelcomeEmail } from "../../src/quills/templates/welcome";

export default function Preview(props: ComponentProps<typeof WelcomeEmail>) {
  return createElement(WelcomeEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  name: "Alex",
  dashboardUrl: "https://app.quills.io/acme",
} satisfies ComponentProps<typeof WelcomeEmail>;
