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
import useWorkspaceStore from "@/store/workspace";
import type { ReactNode } from "react";

interface WorkspaceLayoutProps {
  title: string;
  headerActions?: ReactNode;
  children: ReactNode;
  onCreateProject?: () => void;
}

export default function WorkspaceLayout({
  title,
  headerActions,
  children,
}: WorkspaceLayoutProps) {
  const { workspace } = useWorkspaceStore();

  return (
    <Layout>
      <Layout.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 w-full">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2">
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
              className="mx-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb className="flex items-center gap-1 text-sm w-full">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">
                    <h1 className="text-md text-card-foreground">
                      {workspace?.name}
                    </h1>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <h1 className="text-md text-card-foreground">{title}</h1>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />

            {headerActions}
          </div>
        </div>
      </Layout.Header>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
