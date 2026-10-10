import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { KbdSequence } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";

type WorkspaceLayoutProps = {
  title: string;
  headerActions?: ReactNode;
  children: ReactNode;
  onCreateProject?: () => void;
  className?: string;
};

export default function WorkspaceLayout({
  title,
  headerActions,
  children,
  className,
}: WorkspaceLayoutProps) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();

  return (
    <Layout>
      <Layout.Header>
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1 h-6 w-6" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2 text-[10px]">
                    {t("navigation:settingsLayout.toggleSidebar")}
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
            <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
            <Breadcrumb className="flex min-w-0 items-center gap-1 text-xs">
              <BreadcrumbList className="min-w-0 flex-nowrap">
                {workspace?.name && (
                  <>
                    {/* The page title alone identifies the page on phones. */}
                    <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
                      <BreadcrumbLink href="/" className="min-w-0 truncate">
                        <span className="text-xs font-normal text-card-foreground">
                          {workspace.name}
                        </span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" />
                  </>
                )}
                <BreadcrumbItem className="min-w-0">
                  <span className="truncate text-xs font-normal text-card-foreground">
                    {title}
                  </span>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
            {headerActions}
          </div>
        </div>
      </Layout.Header>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
