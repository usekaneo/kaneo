import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArchiveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useArchiveProject from "@/hooks/mutations/project/use-archive-project";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import { toast } from "@/lib/toast";
import type { ProjectWithTasks } from "@/types/project";

type ProjectDangerZoneProps = {
  project: ProjectWithTasks | undefined;
  isCurrentProject: boolean;
  workspaceId: string | undefined;
  canArchive: boolean;
  canDelete: boolean;
};

export function ProjectDangerZone({
  project,
  isCurrentProject,
  workspaceId,
  canArchive,
  canDelete,
}: ProjectDangerZoneProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { mutateAsync: deleteProject, isPending } = useDeleteProject();
  const { mutateAsync: archiveProject, isPending: isArchiving } =
    useArchiveProject();
  const name = project?.name ?? "";

  const leaveProject = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects"] });

    navigate({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: workspaceId || "" },
    });
  };

  const handleArchive = async () => {
    if (!isCurrentProject || !project?.id) return;

    try {
      await archiveProject({ id: project.id });
      toast.success(t("settings:projectGeneral.toastArchived"), {
        icon: ArchiveIcon,
      });
      setArchiveOpen(false);
      await leaveProject();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectGeneral.toastArchiveError"),
      );
    }
  };

  const handleDelete = async () => {
    if (!isCurrentProject || !project?.id) return;

    try {
      await deleteProject({ id: project.id });
      toast.success(t("settings:projectGeneral.toastDeleted"), {
        icon: Trash2Icon,
      });
      setOpen(false);
      await leaveProject();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectGeneral.toastDeleteError"),
      );
    }
  };

  return (
    <SettingsSection title={t("settings:projectGeneral.dangerZone")}>
      <SettingsCard tone="danger">
        {canArchive ? (
          <SettingsRow
            stack
            title={t("settings:projectGeneral.archiveProject")}
            description={t(
              "settings:projectGeneral.archiveProjectDescription",
              {
                name,
              },
            )}
          >
            <Button
              type="button"
              variant="destructive-outline"
              size="sm"
              disabled={!project || !isCurrentProject}
              onClick={() => setArchiveOpen(true)}
            >
              {t("settings:projectGeneral.archiveProject")}
            </Button>
          </SettingsRow>
        ) : null}
        {canDelete ? (
          <SettingsRow
            stack
            title={t("settings:projectGeneral.deleteProject")}
            description={t("settings:projectGeneral.deleteProjectDescription", {
              name,
            })}
          >
            <Button
              type="button"
              variant="destructive-outline"
              size="sm"
              disabled={!project || !isCurrentProject}
              onClick={() => setOpen(true)}
            >
              {t("settings:projectGeneral.deleteProject")}
            </Button>
          </SettingsRow>
        ) : null}
      </SettingsCard>
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t("settings:projectGeneral.archiveModalTitle")}
        description={t("settings:projectGeneral.archiveModalDescription", {
          name,
        })}
        confirmLabel={t("settings:projectGeneral.archiveModalConfirm")}
        pendingLabel={t("settings:projectGeneral.archiving")}
        pending={isArchiving}
        onConfirm={handleArchive}
      />
      {canDelete ? (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={t("settings:projectGeneral.deleteModalTitle")}
          description={t("settings:projectGeneral.deleteModalDescription", {
            name,
          })}
          confirmLabel={t("settings:projectGeneral.deleteModalConfirm")}
          pendingLabel={t("common:actions.deleting")}
          pending={isPending}
          onConfirm={handleDelete}
        />
      ) : null}
    </SettingsSection>
  );
}
