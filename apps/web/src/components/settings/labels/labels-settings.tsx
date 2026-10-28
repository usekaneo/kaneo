import { PlusIcon, TagIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DeleteLabelDialog } from "@/components/settings/labels/delete-label-dialog";
import { LabelDialog } from "@/components/settings/labels/label-dialog";
import { LabelRow } from "@/components/settings/labels/label-row";
import type { WorkspaceLabel } from "@/components/settings/labels/workspace-label";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function LabelsSettings() {
  const { t } = useTranslation();
  const { workspace, canCreateLabels, canUpdateLabels, canDeleteLabels } =
    useWorkspacePermission();
  const canCreate = canCreateLabels();
  const canUpdate = canUpdateLabels();
  const canDelete = canDeleteLabels();
  const workspaceId = workspace?.id ?? "";
  const labelsQuery = useGetLabelsByWorkspace(workspaceId);
  const workspaceLabels = (labelsQuery.data ?? []).filter(
    (label) => !label.taskId,
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<WorkspaceLabel | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingLabel, setDeletingLabel] = useState<WorkspaceLabel | null>(
    null,
  );

  const openLabelDialog = (label: WorkspaceLabel | null) => {
    setEditingLabel(label);
    setDialogOpen(true);
  };

  const openDeleteDialog = (label: WorkspaceLabel) => {
    setDeletingLabel(label);
    setDeleteOpen(true);
  };

  const newLabelButton = canCreate ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openLabelDialog(null)}
    >
      <PlusIcon aria-hidden="true" />
      {t("settings:workspaceLabels.newLabel")}
    </Button>
  ) : null;

  const renderLabels = () => {
    if (labelsQuery.isPending) return <SettingsRowsSkeleton />;
    if (labelsQuery.isError) {
      return (
        <p
          role="alert"
          className="px-4 py-3.5 text-destructive-foreground text-sm"
        >
          {t("settings:workspaceLabels.loadError")}
        </p>
      );
    }
    if (workspaceLabels.length === 0) {
      return (
        <SettingsEmpty
          icon={<TagIcon />}
          title={t("settings:workspaceLabels.emptyTitle")}
          description={t("settings:workspaceLabels.emptyDescription")}
          action={newLabelButton}
        />
      );
    }
    return workspaceLabels.map((label) => (
      <LabelRow
        key={label.id}
        label={label}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onEdit={openLabelDialog}
        onDelete={openDeleteDialog}
      />
    ));
  };

  return (
    <>
      <SettingsPage
        title={t("settings:workspaceLabels.title")}
        description={
          workspace?.name
            ? t("settings:workspaceLabels.subtitleWithWorkspace", {
                workspaceName: workspace.name,
              })
            : t("settings:workspaceLabels.subtitle")
        }
        actions={newLabelButton}
      >
        <SettingsSection
          title={t("settings:workspaceLabels.sectionTitle")}
          description={t("settings:workspaceLabels.sectionDescription")}
        >
          <SettingsCard>{renderLabels()}</SettingsCard>
        </SettingsSection>
      </SettingsPage>

      <LabelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        label={editingLabel}
        workspaceId={workspaceId}
      />
      <DeleteLabelDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        label={deletingLabel}
      />
    </>
  );
}
