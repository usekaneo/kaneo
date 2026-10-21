import { useTranslation } from "react-i18next";
import type { WorkspaceTask } from "@/fetchers/task/get-workspace-tasks";
import { WorkspaceTaskCard } from "./workspace-task-card";

type Props = { tasks: WorkspaceTask[]; workspaceId: string };
export function WorkspaceTaskBoard({ tasks, workspaceId }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid min-w-[48rem] grid-cols-2 gap-4 p-4">
      {[false, true].map((completed) => (
        <section
          key={String(completed)}
          className="min-w-0 rounded-lg border bg-muted/20 p-3"
        >
          <h2 className="mb-3 font-medium text-sm">
            {t(
              completed
                ? "workspace:taskViews.completed"
                : "workspace:taskViews.open",
            )}
          </h2>
          <div className="space-y-2">
            {tasks
              .filter((task) => task.completed === completed)
              .map((task) => (
                <WorkspaceTaskCard
                  key={task.id}
                  task={task}
                  workspaceId={workspaceId}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
