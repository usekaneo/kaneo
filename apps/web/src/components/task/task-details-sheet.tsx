import { useNavigate } from "@tanstack/react-router";
import { Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { cn } from "@/lib/cn";
import TaskDetailsContent from "./task-details-content";
import TaskPropertiesSidebar from "./task-properties-sidebar";

type TaskDetailsSheetProps = {
  taskId: string | undefined;
  projectId: string;
  workspaceId: string;
  onClose: () => void;
};

export default function TaskDetailsSheet({
  taskId,
  projectId,
  workspaceId,
  onClose,
}: TaskDetailsSheetProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(
    taskId,
  );

  const { data: task } = useGetTask(currentTaskId ?? "");
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  useEffect(() => {
    if (taskId) {
      setCurrentTaskId(taskId);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setCurrentTaskId(undefined);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [taskId]);

  const handleOpenFullPage = useCallback(() => {
    if (!currentTaskId) return;
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId,
        projectId,
        taskId: currentTaskId,
      },
    });
  }, [navigate, workspaceId, projectId, currentTaskId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisible) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isVisible &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isVisible, onClose]);

  if (!currentTaskId && !isVisible) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute top-0 right-0 bottom-0 w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-2xl bg-background border-l border-border shadow-xl z-40 flex flex-col transform transition-transform duration-300 ease-in-out",
        isVisible ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {project?.slug}-{task?.number}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenFullPage}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Maximize2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in full page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto order-2 lg:order-1">
          <div className="px-3 sm:px-4 py-4">
            <TaskDetailsContent
              taskId={currentTaskId}
              projectId={projectId}
              workspaceId={workspaceId}
              className="flex flex-col gap-2"
            />
          </div>
        </div>

        <TaskPropertiesSidebar
          taskId={currentTaskId}
          projectId={projectId}
          workspaceId={workspaceId}
          className="w-full lg:w-52 bg-sidebar border-b lg:border-b-0 lg:border-l border-border flex flex-col gap-2 overflow-y-auto shrink-0 order-1 lg:order-2"
        />
      </div>
    </div>
  );
}
