import { createFileRoute } from "@tanstack/react-router";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const Route = createFileRoute("/_layout/_authenticated/onboarding")({
  component: OnboardingFlow,
});
