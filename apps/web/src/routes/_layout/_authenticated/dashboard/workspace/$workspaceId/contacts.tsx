import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { ContactsPanel } from "@/components/contacts/contacts-panel";
import PageTitle from "@/components/page-title";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/contacts",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { canCreateTasks, canUpdateTasks, canDeleteTasks } =
    useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("workspace:contacts.pageTitle")} />
      <WorkspaceLayout title={t("workspace:contacts.pageTitle")}>
        <div className="h-full overflow-y-auto">
          <ContactsPanel
            workspaceId={workspaceId}
            canCreate={canCreateTasks()}
            canUpdate={canUpdateTasks()}
            canDelete={canDeleteTasks()}
          />
        </div>
      </WorkspaceLayout>
    </>
  );
}
