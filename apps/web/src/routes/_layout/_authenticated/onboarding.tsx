import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/onboarding")({
  component: OnboardingFlow,
});
