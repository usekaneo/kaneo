import type { ReactNode } from "react";
import Layout from "@/components/common/layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { KbdSequence } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
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
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

interface TaskLayoutProps {
  taskId: string;
  projectId: string;
  workspaceId: string;
  headerActions?: ReactNode;
  children: ReactNode;
  rightSidebar?: ReactNode;
}

export default function TaskLayout({
  taskId,
  projectId,
  workspaceId,
  headerActions,
  children,
  rightSidebar,
}: TaskLayoutProps) {
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: task } = useGetTask(taskId);

  return (
    <Layout className="flex flex-row">
      <div className="flex-1">
        <Layout.Header className="sticky top-0 z-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 w-full">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarTrigger className="-ml-1 h-6 w-6 cursor-pointer text-muted-foreground" />
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
              <Separator
                orientation="vertical"
                className="mx-1.5 data-[orientation=vertical]:h-2.5"
              />
              <Breadcrumb className="flex items-center text-xs w-full">
                <BreadcrumbList className="!gap-1">
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href={`/dashboard/workspace/${workspaceId}`}
                    >
                      <h1 className="text-xs text-muted-foreground">
                        {workspace?.name}
                      </h1>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href={`/dashboard/workspace/${workspaceId}/project/${projectId}/board`}
                    >
                      <h1 className="text-xs text-muted-foreground">
                        {project?.name}
                      </h1>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <h1 className="text-xs text-muted-foreground">
                      {project?.slug}-{task?.number}
                    </h1>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-1.5">{headerActions}</div>
          </div>
        </Layout.Header>
        <Layout.Content>
          <div className="flex h-full">
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </Layout.Content>
      </div>
      {rightSidebar}
    </Layout>
  );
}
