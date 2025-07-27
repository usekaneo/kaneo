import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import TaskActivities from "@/components/task/task-activities";
import TaskComment from "@/components/task/task-comment";
import TaskDescription from "@/components/task/task-description";
import TaskInfo from "@/components/task/task-info";
import TaskTimeTracking from "@/components/task/task-time-tracking";
import TaskTitle from "@/components/task/task-title";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import useProjectStore from "@/store/project";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LayoutGrid, X } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_",
)({
  component: TaskEditPage,
});

function TaskEditPage() {
  const { taskId, projectId, workspaceId } = Route.useParams();
  const { data: project } = useGetTasks(projectId);
  const { data: task, isLoading } = useGetTask(taskId);
  const { setProject } = useProjectStore();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setProject(project);
    }
  }, [project, setProject]);

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center h-screen flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950">
        <div className="p-1.5 bg-linear-to-br from-indigo-500 to-purple-500 rounded-lg shadow-xs animate-spin">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <ProjectLayout
      title={`${project?.slug}-${task?.number}`}
      projectId={projectId}
      workspaceId={workspaceId}
    >
      <PageTitle
        title={`${project?.slug}-${task?.number} · ${task?.title || "Task"}`}
        hideAppName
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex  flex-col bg-card overflow-hidden"
      >
        <header className="sticky top-0 z-10 flex items-center px-4 h-[65px] border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => router.history.back()}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-0.5">
                {project?.slug}-{task?.number}
              </div>
              <TaskTitle setIsSaving={setIsSaving} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            {isSaving && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Saving...
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 md:flex-row overflow-auto">
          <div className="flex-1 min-w-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 flex flex-col-reverse md:flex-row h-full">
            <div className="px-6 py-6 space-y-6 flex-1">
              <div className="space-y-8">
                <TaskDescription setIsSaving={setIsSaving} />
                <TaskTimeTracking taskId={taskId} />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                      Comments & Activity
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        Show all
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pb-8">
                  <TaskComment />
                  <TaskActivities />
                </div>
              </div>
            </div>
            {task && <TaskInfo task={task} setIsSaving={setIsSaving} />}
          </div>
        </div>
      </motion.div>
    </ProjectLayout>
  );
}
