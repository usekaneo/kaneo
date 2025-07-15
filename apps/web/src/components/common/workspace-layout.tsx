import Layout from "@/components/common/layout";
import NotificationDropdown from "@/components/notification/notification-dropdown";
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
  return (
    <Layout>
      <Layout.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
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
            <h1 className="text-lg font-semibold text-card-foreground">
              {title}
            </h1>
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
