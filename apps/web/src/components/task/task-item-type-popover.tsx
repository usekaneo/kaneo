import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import useGetItemTypes from "@/hooks/queries/item-type/use-get-item-types";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import ItemTypeIcon from "./item-type-icon";

type TaskItemTypePopoverProps = {
  task: Task;
  workspaceId: string;
  className?: string;
};

export default function TaskItemTypePopover({
  task,
  workspaceId,
  className,
}: TaskItemTypePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: itemTypes } = useGetItemTypes(workspaceId);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canManageTasks } = useWorkspacePermission();
  const activeItemTypes = (itemTypes ?? []).filter(
    (itemType) => !itemType.archivedAt,
  );
  const selectedItemType = activeItemTypes.find(
    (itemType) => itemType.id === task.itemTypeId,
  );
  const hasArchivedAssignment = Boolean(
    itemTypes && task.itemTypeId && !selectedItemType,
  );

  if (activeItemTypes.length === 0 && !hasArchivedAssignment) return null;

  const defaultLabel = t("tasks:properties.defaultType", {
    defaultValue: "Task",
  });
  const archivedLabel = t("tasks:properties.archivedType", {
    defaultValue: "Archived",
  });
  const selectedLabel = hasArchivedAssignment
    ? archivedLabel
    : (selectedItemType?.name ?? defaultLabel);

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Type: ${selectedLabel}`}
      className={cn("justify-start h-7 px-1.5 gap-1.5", className)}
    >
      <ItemTypeIcon
        icon={selectedItemType?.icon}
        className="h-3.5 w-3.5 text-muted-foreground"
      />
      {hasArchivedAssignment ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {archivedLabel}
        </Badge>
      ) : (
        <span className="text-xs font-semibold truncate">{selectedLabel}</span>
      )}
    </Button>
  );

  if (!canManageTasks()) return trigger;

  const handleSelect = async (nextItemTypeId: string | null) => {
    try {
      await updateTask({ ...task, itemTypeId: nextItemTypeId });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:properties.itemTypeUpdateError", {
              defaultValue: "Failed to update task type.",
            }),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 px-2"
            onClick={() => handleSelect(null)}
          >
            <ItemTypeIcon className="h-4 w-4" />
            <span>{defaultLabel}</span>
            {!task.itemTypeId && <Check className="ml-auto h-4 w-4" />}
          </Button>
          {activeItemTypes.map((itemType) => (
            <Button
              key={itemType.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2"
              onClick={() => handleSelect(itemType.id)}
            >
              <ItemTypeIcon icon={itemType.icon} className="h-4 w-4" />
              <span>{itemType.name}</span>
              {task.itemTypeId === itemType.id && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
