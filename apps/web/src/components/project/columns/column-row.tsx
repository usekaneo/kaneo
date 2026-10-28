import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnIconPicker } from "@/components/project/columns/column-icon-picker";
import type { ProjectColumn } from "@/components/project/columns/types";
import { InlineNameInput } from "@/components/project/inline-name-input";
import { DragHandle } from "@/components/project/sortable/drag-handle";
import { useSortableRow } from "@/components/project/sortable/use-sortable-row";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_COLUMN_ICON_NAMES } from "@/constants/column-icons";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";

type ColumnRowProps = {
  column: ProjectColumn;
  canEdit: boolean;
  onRename: (name: string) => Promise<boolean>;
  onChangeIcon: (icon: string) => void;
  onToggleFinal: (isFinal: boolean) => Promise<void>;
  onDelete: () => void;
};

function selectedIconName(column: ProjectColumn) {
  return (
    column.icon ||
    DEFAULT_COLUMN_ICON_NAMES[
      column.slug as keyof typeof DEFAULT_COLUMN_ICON_NAMES
    ]
  );
}

export function ColumnRow({
  column,
  canEdit,
  onRename,
  onChangeIcon,
  onToggleFinal,
  onDelete,
}: ColumnRowProps) {
  const { t } = useTranslation();
  const { rowRef, rowStyle, isDragging, handleProps } = useSortableRow(
    column.id,
    !canEdit,
  );
  const [pendingFinal, setPendingFinal] = useState<boolean | null>(null);
  const isFinal = pendingFinal ?? column.isFinal;

  const toggleFinal = async (checked: boolean) => {
    setPendingFinal(checked);
    try {
      await onToggleFinal(checked);
    } finally {
      setPendingFinal(null);
    }
  };

  return (
    <div
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group/row flex h-12 items-center gap-2.5 bg-card px-4",
        isDragging && "relative z-10 shadow-sm",
      )}
    >
      <DragHandle
        label={t("settings:columnEditor.dragAria", { name: column.name })}
        handleProps={handleProps}
        disabled={!canEdit}
      />
      <ColumnIconPicker
        selected={selectedIconName(column)}
        label={t("settings:columnEditor.pickIconTitle")}
        disabled={!canEdit}
        onSelect={onChangeIcon}
      >
        {getColumnIcon(column.slug, isFinal, column.icon)}
      </ColumnIconPicker>
      <InlineNameInput
        name={column.name}
        label={t("settings:columnEditor.renameAria", { name: column.name })}
        readOnly={!canEdit}
        onRename={onRename}
      />
      <div className="flex w-13 shrink-0 justify-center">
        <Switch
          checked={isFinal}
          disabled={!canEdit}
          onCheckedChange={(checked) => void toggleFinal(checked)}
          aria-label={t("settings:columnEditor.markDoneAria", {
            name: column.name,
          })}
        />
      </div>
      <div className="flex w-7 shrink-0 justify-center">
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("settings:columnEditor.deleteAria", {
              name: column.name,
            })}
            onClick={onDelete}
            className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
