import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { AutomationsSection } from "@/components/project/automations/automations-section";
import { ColumnList } from "@/components/project/columns/column-list";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/workflow",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("settings:projectWorkflow.pageTitle")} />
      <SettingsPage
        title={t("settings:projectWorkflow.title")}
        description={t("settings:projectWorkflow.subtitle")}
        actions={<AutosaveNote />}
      >
        <SettingsSection
          title={t("settings:projectWorkflow.columnsTitle")}
          description={t("settings:projectWorkflow.columnsDescription")}
        >
          <ColumnList projectId={projectId} />
        </SettingsSection>
        <SettingsSection
          title={t("settings:projectWorkflow.automationTitle")}
          description={t("settings:projectWorkflow.automationDescription")}
        >
          <AutomationsSection projectId={projectId} />
        </SettingsSection>
      </SettingsPage>
    </>
  );
}
