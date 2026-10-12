import { PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LabelDot } from "@/components/settings/labels/label-dot";
import type { WorkspaceLabel } from "@/components/settings/labels/workspace-label";
import {
  type RowAction,
  RowActionsMenu,
} from "@/components/settings/row-actions-menu";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type LabelRowProps = {
  label: WorkspaceLabel;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (label: WorkspaceLabel) => void;
  onDelete: (label: WorkspaceLabel) => void;
};

export function LabelRow({
  label,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: LabelRowProps) {
  const { t } = useTranslation();
  const removing = Boolean(label.deletionStartedAt);
  const editable = canUpdate && !removing;
  const actions: RowAction[] = [];

  if (canUpdate) {
    actions.push({
      id: "edit",
      label: t("settings:workspaceLabels.editLabel"),
      icon: PencilIcon,
      onSelect: () => onEdit(label),
    });
  }
  if (canDelete) {
    actions.push({
      id: "delete",
      label: t("settings:workspaceLabels.deleteLabel"),
      icon: Trash2Icon,
      destructive: true,
      onSelect: () => onDelete(label),
    });
  }

  let trailing: ReactNode = null;
  if (removing && canDelete) {
    trailing = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t("settings:workspaceLabels.resumeDeletion")}
        onClick={() => onDelete(label)}
      >
        {t("settings:workspaceLabels.resume")}
      </Button>
    );
  } else if (!removing && actions.length > 0) {
    trailing = (
      <div className="relative">
        <RowActionsMenu
          label={t("settings:workspaceLabels.rowActions", {
            name: label.name,
          })}
          actions={actions}
        />
      </div>
    );
  }

  return (
    <SettingsRow
      className={cn(
        editable && "relative transition-colors hover:bg-accent/40",
      )}
      icon={
        <LabelDot
          color={label.color}
          className={cn("size-2.5", removing && "opacity-40")}
        />
      }
      title={
        editable ? (
          <button
            type="button"
            aria-label={t("settings:workspaceLabels.editNamed", {
              name: label.name,
            })}
            onClick={() => onEdit(label)}
            className="max-w-full cursor-pointer truncate text-start outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          >
            {label.name}
          </button>
        ) : (
          label.name
        )
      }
      titleClassName={removing ? "text-muted-foreground" : undefined}
      description={
        removing ? t("settings:workspaceLabels.deletionPending") : undefined
      }
    >
      {trailing}
    </SettingsRow>
  );
}
