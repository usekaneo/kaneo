import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InlineNameInput } from "@/components/project/inline-name-input";
import { DragHandle } from "@/components/project/sortable/drag-handle";
import { useSortableRow } from "@/components/project/sortable/use-sortable-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type FieldOptionRowProps = {
  option: string;
  onRename: (name: string) => boolean;
  onRemove: () => void;
};

export function FieldOptionRow({
  option,
  onRename,
  onRemove,
}: FieldOptionRowProps) {
  const { t } = useTranslation();
  const { rowRef, rowStyle, isDragging, handleProps } = useSortableRow(
    option,
    false,
  );

  return (
    <div
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group/row flex h-9 items-center gap-2.5 bg-background px-2.5 dark:bg-transparent",
        isDragging && "relative z-10 bg-popover shadow-sm dark:bg-popover",
      )}
    >
      <DragHandle
        label={t("settings:customFields.dragOptionAria", { option })}
        handleProps={handleProps}
      />
      <InlineNameInput
        name={option}
        label={t("settings:customFields.renameOptionAria", { option })}
        onRename={onRename}
        className="h-7"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("settings:customFields.removeOptionAria", { option })}
        onClick={onRemove}
        className="text-muted-foreground"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
