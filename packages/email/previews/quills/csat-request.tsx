import { createElement, type ComponentProps } from "react";
import { CsatRequestEmail } from "../../src/quills/templates/csat-request";

export default function Preview(
  props: ComponentProps<typeof CsatRequestEmail>,
) {
  return createElement(CsatRequestEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  promptText: "How helpful was your conversation with our team?",
  ratingUrls: [
    "https://app.quills.io/feedback/rating?rating=1",
    "https://app.quills.io/feedback/rating?rating=2",
    "https://app.quills.io/feedback/rating?rating=3",
    "https://app.quills.io/feedback/rating?rating=4",
    "https://app.quills.io/feedback/rating?rating=5",
  ],
} satisfies ComponentProps<typeof CsatRequestEmail>;
