import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import TaskCrumbSelect from "@/components/common/header/task-crumb-select";
import Layout from "@/components/common/layout";
import { KbdSequence } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";

type TaskLayoutProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  headerActions?: ReactNode;
  children: ReactNode;
  rightSidebar?: ReactNode;
};

export default function TaskLayout({
  taskId,
  projectId,
  workspaceId,
  headerActions,
  children,
  rightSidebar,
}: TaskLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: task } = useGetTask(taskId);

  useProjectWebSocket(projectId);

  const taskLabel =
    project?.slug && task?.number != null
      ? `${project.slug}-${task.number}`
      : t("tasks:common.selectTask");

  const handleTaskSwitch = (nextTaskId: string) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId: nextTaskId },
    });
  };

  return (
    <Layout className="flex flex-col lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <Layout.Header className="h-11 border-border/80 px-2">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarTrigger className="-ml-1 h-7 w-7 cursor-pointer text-foreground/85 hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="flex items-center gap-2 text-[10px]">
                      Toggle sidebar
                      <KbdSequence
                        keys={[
                          shortcuts.sidebar.prefix,
                          shortcuts.sidebar.toggle,
                        ]}
                      />
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="h-4 w-px shrink-0 bg-border/80" />

              <div className="min-w-0 items-center gap-1.5 flex">
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
                      params: { workspaceId, projectId },
                    })
                  }
                  className="max-w-40 truncate text-left text-xs text-foreground hover:underline"
                >
                  {project?.name || t("navigation:sidebar.projects")}
                </button>
                <span className="text-foreground/70 text-xs">/</span>
                <TaskCrumbSelect
                  projectId={projectId}
                  taskId={taskId}
                  taskLabel={taskLabel}
                  onSelectTask={handleTaskSwitch}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {headerActions}
            </div>
          </div>
        </Layout.Header>

        <Layout.Content>
          <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
            <div className="order-2 min-h-0 flex-1 overflow-y-auto overscroll-contain lg:order-1">
              {children}
            </div>
            <div className="order-1 border-b border-border/80 lg:order-2 lg:hidden">
              {rightSidebar}
            </div>
          </div>
        </Layout.Content>
      </div>
      <div className="hidden border-l border-border/80 bg-card lg:flex lg:h-full lg:overflow-y-auto">
        {rightSidebar}
      </div>
    </Layout>
  );
}
