import { Eye, EyeOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InlineNameInput } from "@/components/project/inline-name-input";
import { DragHandle } from "@/components/project/sortable/drag-handle";
import { useSortableRow } from "@/components/project/sortable/use-sortable-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type FieldOptionRowProps = {
  option: string;
  hidden: boolean;
  onRename: (name: string) => boolean;
  onRemove: () => void;
  /** Hiding retires an option; only offered for fields that already exist. */
  onToggleHidden?: () => void;
};

export function FieldOptionRow({
  option,
  hidden,
  onRename,
  onRemove,
  onToggleHidden,
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
        className={cn("h-7", hidden && "text-muted-foreground")}
      />
      {onToggleHidden ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t(
            hidden
              ? "settings:customFields.showOptionAria"
              : "settings:customFields.hideOptionAria",
            { option },
          )}
          aria-pressed={hidden}
          onClick={onToggleHidden}
          className="text-muted-foreground"
        >
          {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      ) : null}
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
