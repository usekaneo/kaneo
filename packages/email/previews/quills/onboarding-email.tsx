import { createElement, type ComponentProps } from "react";
import { OnboardingEmail } from "../../src/quills/templates/onboarding-email";

export default function Preview(props: ComponentProps<typeof OnboardingEmail>) {
  return createElement(OnboardingEmail, props);
}

Preview.PreviewProps = {
  workspaceName: "Acme",
  unsubscribeUrl: "https://app.quills.io/settings/notifications/unsubscribe",
  lang: "en",
  dir: "ltr",
  preview: "Your workspace is ready for its first conversation",
  heading: "Welcome to your new workspace",
  paragraphs: [
    "Hi Alex, your Acme workspace is ready.",
    "Invite your team and collect your first piece of feedback.",
  ],
  share: {
    label: "Share your feedback portal",
    url: "https://app.quills.io/acme",
    text: "Tell us what you would like to see next.",
  },
  cta: {
    label: "Open your workspace",
    url: "https://app.quills.io/acme",
  },
  secondary: {
    lead: "Need a hand?",
    label: "Read the getting started guide",
    url: "https://app.quills.io/help",
  },
  footer: {
    reason: "You created an Acme workspace.",
    unsubscribeLabel: "Unsubscribe",
  },
} satisfies ComponentProps<typeof OnboardingEmail>;
