import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertDialogCreateHandle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskSheetHeader } from "./header/task-sheet-header";
import { PropertiesRail } from "./properties/properties-rail";
import { PropertyChips } from "./properties/property-chips";
import TaskDeleteDialog from "./task-delete-dialog";
import TaskDetailsContent from "./task-details-content";
import { TaskShortcuts } from "./task-shortcuts";

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
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(
    taskId,
  );
  const [deleteHandle] = useState(() => AlertDialogCreateHandle());

  const lastTaskIdRef = useRef(taskId);

  useEffect(() => {
    if (taskId) {
      lastTaskIdRef.current = taskId;
      // Update taskId immediately without closing/reopening
      setCurrentTaskId(taskId);
    } else {
      // Delay clearing to allow exit animation
      const timer = setTimeout(() => {
        setCurrentTaskId(undefined);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [taskId]);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        data-task-view
        data-shortcuts="allow"
        className="w-full max-w-full gap-0 p-0 sm:max-w-lg md:max-w-2xl lg:max-w-4xl [&>button]:hidden"
        // Focusing the first control would pop the "open in full page"
        // tooltip over the actions every time the sheet opens on touch.
        initialFocus={closeButtonRef}
        finalFocus={() =>
          document.querySelector<HTMLElement>(
            `[data-task-id="${lastTaskIdRef.current}"]`,
          ) ?? true
        }
      >
        {currentTaskId && (
          <TaskSheetHeader
            taskId={currentTaskId}
            projectId={projectId}
            workspaceId={workspaceId}
            deleteHandle={deleteHandle}
            onOpenFullPage={handleOpenFullPage}
            onClose={onClose}
            closeButtonRef={closeButtonRef}
          />
        )}

        {currentTaskId && (
          <TaskShortcuts
            taskId={currentTaskId}
            projectId={projectId}
            workspaceId={workspaceId}
            enabled={Boolean(taskId)}
          />
        )}
        {currentTaskId && (
          <TaskDeleteDialog
            handle={deleteHandle}
            taskId={currentTaskId}
            onDeleted={onClose}
            shortcutEnabled={Boolean(taskId)}
          />
        )}
        {currentTaskId && (
          <div
            key={currentTaskId}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
          >
            <div className="min-w-0 flex-1 lg:overflow-y-auto">
              <TaskDetailsContent
                taskId={currentTaskId}
                projectId={projectId}
                workspaceId={workspaceId}
                className="px-5 pt-5 pb-10 lg:px-9 lg:pt-7"
                properties={
                  <PropertyChips
                    taskId={currentTaskId}
                    projectId={projectId}
                    workspaceId={workspaceId}
                    className="pb-5 lg:hidden"
                  />
                }
              />
            </div>
            <PropertiesRail
              taskId={currentTaskId}
              projectId={projectId}
              workspaceId={workspaceId}
              className="hidden w-73 shrink-0 overflow-y-auto border-border border-l lg:flex"
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
