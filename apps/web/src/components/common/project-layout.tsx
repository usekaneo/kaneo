import Layout from "@/components/common/layout";
import NotificationDropdown from "@/components/notification/notification-dropdown";
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
import useWorkspaceStore from "@/store/workspace";
import type { ReactNode } from "react";

interface ProjectLayoutProps {
  projectId: string;
  workspaceId: string;
  title: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export default function ProjectLayout({
  projectId,
  workspaceId,
  title,
  headerActions,
  children,
}: ProjectLayoutProps) {
  const { workspace } = useWorkspaceStore();
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  return (
    <Layout>
      <Layout.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 w-full">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1 h-6 w-6" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2 text-xs">
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
            <Breadcrumb className="flex items-center gap-1 text-xs w-full">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href={`/dashboard/workspace/${workspaceId}`}>
                    <h1 className="text-xs text-card-foreground">
                      {workspace?.name}
                    </h1>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={`/dashboard/workspace/${workspaceId}/project/${projectId}/board`}
                  >
                    <h1 className="text-xs text-card-foreground">
                      {project?.name}
                    </h1>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <h1 className="text-xs text-card-foreground">{title}</h1>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
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
