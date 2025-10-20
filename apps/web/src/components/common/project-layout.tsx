import { useLocation, useNavigate } from "@tanstack/react-router";
import { SquareKanban, SquircleDashed } from "lucide-react";
import type { ReactNode } from "react";
import Layout from "@/components/common/layout";
import NotificationDropdown from "@/components/notification/notification-dropdown";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";

interface ProjectLayoutProps {
  projectId: string;
  workspaceId: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export default function ProjectLayout({
  projectId,
  workspaceId,
  headerActions,
  children,
}: ProjectLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  const isBacklogRoute = location.pathname.includes("/backlog");
  const isBoardRoute = location.pathname.includes("/board");

  const handleNavigateToBacklog = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToBoard = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: { workspaceId, projectId },
    });
  };

  return (
    <Layout>
      <Layout.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-5 w-full">
            <div className="flex items-center gap-1">
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
              <Breadcrumb className="flex items-center text-xs">
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
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={handleNavigateToBacklog}
                className={cn(
                  "gap-1.5 h-6 px-2 text-xs text-muted-foreground",
                  isBacklogRoute && "text-black dark:text-white",
                )}
              >
                <SquircleDashed className="w-3 h-3" />
                Backlog
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={handleNavigateToBoard}
                className="gap-1.5 h-6 px-2 text-xs text-muted-foreground"
              >
                <SquareKanban className="w-3 h-3" />
                <span
                  className={cn(
                    "text-xs text-muted-foreground",
                    isBoardRoute && "text-black dark:text-white",
                  )}
                >
                  Tasks
                </span>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationDropdown />
            {headerActions}
          </div>
        </div>
      </Layout.Header>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
