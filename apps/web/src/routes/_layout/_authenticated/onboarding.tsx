import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import PageTitle from "@/components/page-title";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";

export const Route = createFileRoute("/_layout/_authenticated/onboarding")({
  beforeLoad: async () => {
    let hasWorkspace = false;
    try {
      hasWorkspace = (await getWorkspaces()).length > 0;
    } catch {
      return;
    }
    if (hasWorkspace) {
      throw redirect({ to: "/dashboard" });
    }
  },
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
