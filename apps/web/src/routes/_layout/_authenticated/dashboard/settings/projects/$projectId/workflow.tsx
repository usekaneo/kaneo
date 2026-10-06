import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import ColumnEditor from "@/components/project/column-editor";
import CustomFieldEditor from "@/components/project/custom-field-editor";
import WorkflowEditor from "@/components/project/workflow-editor";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

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
      >
        <div className="space-y-3">
          <SettingsSectionHeader
            title={t("settings:projectWorkflow.columnsTitle")}
            description={t("settings:projectWorkflow.columnsDescription")}
          />
          <ColumnEditor projectId={projectId} />
        </div>

        <div className="space-y-3">
          <SettingsSectionHeader
            title={t("settings:projectWorkflow.customFieldsTitle")}
            description={t("settings:projectWorkflow.customFieldsDescription")}
          />
          <CustomFieldEditor projectId={projectId} />
        </div>

        <div className="space-y-3">
          <SettingsSectionHeader
            title={t("settings:projectWorkflow.automationTitle")}
            description={t("settings:projectWorkflow.automationDescription")}
          />
          <WorkflowEditor projectId={projectId} />
        </div>
      </SettingsPage>
    </>
  );
}
