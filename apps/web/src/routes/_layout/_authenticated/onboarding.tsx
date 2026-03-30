import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute("/_layout/_authenticated/onboarding")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("auth:onboarding.pageTitle")} />
      <OnboardingFlow />
    </>
  );
}
