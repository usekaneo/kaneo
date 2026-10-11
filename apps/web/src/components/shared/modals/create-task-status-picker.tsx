import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getSelectableTaskColumns } from "./selectable-task-columns";

type StatusColumn = {
  id: string;
  slug: string;
  name: string;
  isFinal: boolean;
  icon: string | null;
};

type CreateTaskStatusPickerProps = {
  value: string;
  columns: StatusColumn[] | undefined;
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  allowPlanned: boolean;
  onChange: (status: string) => void;
  onRetry: () => void;
};

export default function CreateTaskStatusPicker({
  value,
  columns,
  isLoading,
  isError,
  disabled,
  allowPlanned,
  onChange,
  onRetry,
}: CreateTaskStatusPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentColumn = columns?.find((column) => column.slug === value);
  const selectableColumns = getSelectableTaskColumns(columns);
  const showPlanned =
    allowPlanned && !columns?.some((column) => column.slug === "planned");

  const selectStatus = (slug: string) => {
    onChange(slug);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("common:modals.createTask.status")}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/50 text-foreground rounded-md text-xs font-medium border border-border hover:bg-accent disabled:opacity-50"
        >
          {getColumnIcon(value, currentColumn?.isFinal, currentColumn?.icon)}
          {getStatusDisplayLabel(value, currentColumn?.name)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {isError ? (
          <div className="p-2 text-sm text-destructive" role="alert">
            {t("common:modals.createTask.statusLoadError")}
            <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
              {t("common:error.tryAgain")}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-2 text-sm text-muted-foreground">
            {t("common:empty.loading")}
          </div>
        ) : (
          <div className="space-y-1">
            {showPlanned && (
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 text-left h-8"
                onClick={() => selectStatus("planned")}
              >
                {getColumnIcon("planned")}
                {getStatusDisplayLabel("planned")}
                {value === "planned" && <Check className="ml-auto h-4 w-4" />}
              </button>
            )}
            {selectableColumns.map((column) => (
              <button
                key={column.id}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 text-left h-8"
                onClick={() => selectStatus(column.slug)}
              >
                {getColumnIcon(column.slug, column.isFinal, column.icon)}
                <span className="truncate">
                  {getStatusDisplayLabel(column.slug, column.name)}
                </span>
                {value === column.slug && (
                  <Check className="ml-auto h-4 w-4 shrink-0" />
                )}
              </button>
            ))}
            {selectableColumns.length === 0 && !showPlanned && (
              <div className="p-2 text-sm text-muted-foreground">
                {t("common:modals.createTask.noStatuses")}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
