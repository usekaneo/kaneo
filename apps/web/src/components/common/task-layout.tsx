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
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: task } = useGetTask(taskId);

  return (
    <Layout className="flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col min-w-0">
        <Layout.Header className="sticky top-0 z-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 w-full min-w-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarTrigger className="-ml-1 h-6 w-6 cursor-pointer text-muted-foreground shrink-0" />
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
                className="mx-1.5 data-[orientation=vertical]:h-2.5 shrink-0"
              />
              <Breadcrumb className="flex items-center text-xs w-full min-w-0">
                <BreadcrumbList className="!gap-1 flex-wrap">
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    <BreadcrumbLink
                      href={`/dashboard/workspace/${workspaceId}`}
                    >
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {workspace?.name}
                      </span>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:inline-flex" />
                  <BreadcrumbItem className="hidden md:inline-flex">
                    <BreadcrumbLink
                      href={`/dashboard/workspace/${workspaceId}/project/${projectId}/board`}
                    >
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {project?.name}
                      </span>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:inline-flex" />
                  <BreadcrumbItem>
                    <span className="text-xs text-muted-foreground">
                      {project?.slug}-{task?.number}
                    </span>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}
            </div>
          </div>
        </Layout.Header>
        <Layout.Content>
          <div className="flex flex-col lg:flex-row h-full">
            <div className="order-2 lg:order-1 flex-1 min-w-0">{children}</div>
            <div className="order-1 lg:order-2 lg:hidden">{rightSidebar}</div>
          </div>
        </Layout.Content>
      </div>
      <div className="hidden lg:flex lg:h-full">{rightSidebar}</div>
    </Layout>
  );
}
