import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { describeCustomField } from "@/components/project/custom-fields/describe-custom-field";
import {
  FIELD_KIND_ICONS,
  toFieldKind,
} from "@/components/project/custom-fields/field-kinds";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { DragHandle } from "@/components/project/sortable/drag-handle";
import { useSortableRow } from "@/components/project/sortable/use-sortable-row";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { SettingsIconTile } from "@/components/settings/settings-icon-tile";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

type CustomFieldRowProps = {
  field: CustomFieldDefinition;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function CustomFieldRow({
  field,
  canEdit,
  onEdit,
  onDelete,
}: CustomFieldRowProps) {
  const { t, i18n } = useTranslation();
  const { rowRef, rowStyle, isDragging, handleProps } = useSortableRow(
    field.id,
    !canEdit,
  );
  const Icon = FIELD_KIND_ICONS[toFieldKind(field.type)];

  return (
    <div
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group/row flex items-center gap-3 bg-card px-4 py-3.5",
        isDragging && "relative z-10 shadow-sm",
      )}
    >
      <DragHandle
        label={t("settings:customFields.dragAria", { name: field.name })}
        handleProps={handleProps}
        disabled={!canEdit}
      />
      <SettingsIconTile>
        <Icon />
      </SettingsIconTile>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{field.name}</p>
          {field.required ? (
            <Badge variant="outline" className="text-muted-foreground">
              {t("settings:customFields.required")}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {describeCustomField(field, t, i18n?.language)}
        </p>
      </div>
      {canEdit ? (
        <RowActionsMenu
          label={t("settings:customFields.actionsAria", { name: field.name })}
          actions={[
            {
              id: "edit",
              label: t("settings:customFields.edit"),
              icon: Pencil,
              onSelect: onEdit,
            },
            {
              id: "delete",
              label: t("common:actions.delete"),
              icon: Trash2,
              onSelect: onDelete,
              destructive: true,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
