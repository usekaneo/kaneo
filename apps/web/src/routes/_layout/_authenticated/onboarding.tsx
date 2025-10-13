import { createFileRoute } from "@tanstack/react-router";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute("/_layout/_authenticated/onboarding")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageTitle title="Welcome to Kaneo" />
      <OnboardingFlow />
    </>
  );
}
