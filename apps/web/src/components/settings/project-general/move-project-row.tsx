import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, FolderInputIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useMoveProject from "@/hooks/mutations/project/use-move-project";
import { toast } from "@/lib/toast";

type MoveTarget = { id: string; name: string };

type MoveProjectRowProps = {
  projectId: string;
  targets: MoveTarget[];
  targetsFailed: boolean;
  flushPendingSave: () => Promise<boolean>;
};

export function MoveProjectRow({
  projectId,
  targets,
  targetsFailed,
  flushPendingSave,
}: MoveProjectRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutateAsync: moveProject } = useMoveProject();
  const target = targets.find((item) => item.id === targetWorkspaceId);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTargetWorkspaceId("");
  };

  const handleMove = async () => {
    if (!target || isSubmitting) return;

    setIsSubmitting(true);
    const flushed = await flushPendingSave();
    if (!flushed) {
      setIsSubmitting(false);
      handleOpenChange(false);
      toast.error(t("settings:projectGeneral.toastMoveError"));
      return;
    }

    try {
      const moved = await moveProject({
        id: projectId,
        workspaceId: target.id,
      });

      toast.success(
        moved.unassignedTaskCount > 0
          ? t("settings:projectGeneral.toastMovedWithUnassigned", {
              taskCount: moved.unassignedTaskCount,
            })
          : t("settings:projectGeneral.toastMoved"),
        { icon: FolderInputIcon },
      );
      handleOpenChange(false);

      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId",
        params: { workspaceId: target.id, projectId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectGeneral.toastMoveError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SettingsRow
      stack
      icon={<ArrowRight />}
      title={t("settings:projectGeneral.moveProject")}
      description={t("settings:projectGeneral.moveProjectDescription")}
    >
      {targetsFailed ? (
        <p className="max-w-64 text-xs text-destructive">
          {t("settings:projectGeneral.moveTargetsError")}
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-24"
          onClick={() => setOpen(true)}
        >
          {t("settings:projectGeneral.moveProjectAction")}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        destructive={false}
        title={t("settings:projectGeneral.moveDialogTitle")}
        description={t("settings:projectGeneral.moveDialogDescription")}
        confirmLabel={t("settings:projectGeneral.moveModalConfirm")}
        pendingLabel={t("settings:projectGeneral.moving")}
        pending={isSubmitting}
        confirmDisabled={!target}
        onConfirm={handleMove}
      >
        <div className="space-y-2">
          <Label htmlFor={selectId}>
            {t("settings:projectGeneral.moveTargetLabel")}
          </Label>
          <Select
            value={targetWorkspaceId}
            onValueChange={(value) => setTargetWorkspaceId(value ?? "")}
          >
            <SelectTrigger id={selectId}>
              <SelectValue
                placeholder={t(
                  "settings:projectGeneral.moveProjectPlaceholder",
                )}
              >
                {target?.name ??
                  t("settings:projectGeneral.moveProjectPlaceholder")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {targets.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>
    </SettingsRow>
  );
}
