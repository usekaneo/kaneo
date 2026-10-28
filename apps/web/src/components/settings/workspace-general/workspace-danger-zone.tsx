import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useDeleteWorkspace from "@/hooks/mutations/workspace/use-delete-workspace";
import { toast } from "@/lib/toast";

type WorkspaceDangerZoneProps = {
  workspaceId: string | undefined;
  workspaceName: string;
};

export function WorkspaceDangerZone({
  workspaceId,
  workspaceName,
}: WorkspaceDangerZoneProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { mutateAsync: deleteWorkspace, isPending } = useDeleteWorkspace();

  const handleDelete = async () => {
    if (!workspaceId) return;

    try {
      await deleteWorkspace({ workspaceId });
      toast.success(t("settings:workspaceGeneral.toastDeleted"), {
        icon: Trash2Icon,
      });
      setOpen(false);

      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({
        queryKey: ["active-organization"],
      });

      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceGeneral.toastDeleteError"),
      );
    }
  };

  return (
    <SettingsSection title={t("settings:workspaceGeneral.dangerZone")}>
      <SettingsCard tone="danger">
        <SettingsRow
          stack
          title={t("settings:workspaceGeneral.deleteWorkspace")}
          description={t(
            "settings:workspaceGeneral.deleteWorkspaceDescription",
            {
              name: workspaceName,
            },
          )}
        >
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            disabled={!workspaceId}
            onClick={() => setOpen(true)}
          >
            {t("settings:workspaceGeneral.deleteWorkspace")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("settings:workspaceGeneral.deleteModalTitle")}
        description={t("settings:workspaceGeneral.deleteModalDescription", {
          name: workspaceName,
        })}
        confirmLabel={t("settings:workspaceGeneral.deleteModalConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={isPending}
        onConfirm={handleDelete}
      />
    </SettingsSection>
  );
}
