import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { SettingsPage } from "@/components/settings/settings-page";
import { OwnershipSection } from "@/components/settings/workspace-general/ownership-section";
import { useWorkspaceAutosave } from "@/components/settings/workspace-general/use-workspace-autosave";
import { WorkspaceDangerZone } from "@/components/settings/workspace-general/workspace-danger-zone";
import { WorkspaceDetailsSection } from "@/components/settings/workspace-general/workspace-details-section";
import { getWorkspaceDescription } from "@/components/settings/workspace-general/workspace-form-values";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetFullWorkspace from "@/hooks/queries/workspace/use-get-full-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function WorkspaceGeneralPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { data: workspace } = useActiveWorkspace();
  const { data: fullWorkspace } = useGetFullWorkspace({
    workspaceId: workspace?.id,
  });
  const { canManageWorkspace, canDeleteWorkspace, isOwner } =
    useWorkspacePermission();
  const canEdit = canManageWorkspace();
  const canDelete = canDeleteWorkspace();
  const workspaceName = workspace?.name ?? "";
  const form = useWorkspaceAutosave({
    workspaceId: workspace?.id,
    name: workspace?.name,
    description: getWorkspaceDescription(workspace),
    canEdit,
  });

  return (
    <>
      <PageTitle title={t("settings:workspaceGeneral.pageTitle")} />
      <SettingsPage
        title={t("settings:workspaceGeneral.title")}
        description={
          workspaceName
            ? t("settings:workspaceGeneral.subtitle", { name: workspaceName })
            : undefined
        }
        actions={canEdit ? <AutosaveNote /> : undefined}
      >
        <WorkspaceDetailsSection form={form} canEdit={canEdit} />
        {isOwner ? (
          <OwnershipSection
            workspaceId={workspace?.id}
            workspaceName={workspaceName}
            members={fullWorkspace?.members ?? []}
            currentUserId={currentUser?.id}
          />
        ) : null}
        {canDelete ? (
          <WorkspaceDangerZone
            workspaceId={workspace?.id}
            workspaceName={workspaceName}
          />
        ) : null}
      </SettingsPage>
    </>
  );
}
