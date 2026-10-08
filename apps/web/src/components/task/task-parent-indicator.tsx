import { useNavigate } from "@tanstack/react-router";
import { CornerDownRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import type Task from "@/types/task";
import { cn } from "@/lib/cn";
import {
  taskPropertyTriggerBaseClassName,
  taskPropertyTriggerClassNames,
} from "./task-property-trigger.styles";

export default function TaskParentIndicator({
  parents,
  workspaceId,
}: {
  parents: Task["subtaskParents"];
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!parents?.length) return null;
  const labels = parents.map((parent) =>
    t("tasks:subtasks.parentIndicator", { title: parent.title }),
  );

  return (
    <div className="ml-auto flex shrink-0 gap-1">
      {parents.map((parent, index) => (
        <Tooltip key={parent.id}>
          <TooltipTrigger
            type="button"
            aria-label={labels[index]}
            className={cn(
              taskPropertyTriggerBaseClassName,
              taskPropertyTriggerClassNames.pill,
              "h-5.5 justify-center text-muted-foreground hover:text-foreground",
            )}
            onClick={(event) => {
              event.stopPropagation();
              void navigate({
                to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
                params: {
                  workspaceId,
                  projectId: parent.projectId,
                },
                search: { taskId: parent.id },
              });
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <CornerDownRight className="size-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipPopup>{labels[index]}</TooltipPopup>
        </Tooltip>
      ))}
    </div>
  );
}
