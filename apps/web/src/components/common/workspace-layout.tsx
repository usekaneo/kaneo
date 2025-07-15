import Layout from "@/components/common/layout";
import NotificationDropdown from "@/components/notification/notification-dropdown";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
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
  const navigate = useNavigate();

  const handleSearchNavigation = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/search",
      params: { workspaceId: "current" },
    });
  };

  return (
    <Layout>
      <Layout.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2">
                    Toggle Sidebar
                    <Kbd>[</Kbd>
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSearchNavigation}
                    className="h-9 w-9 p-0"
                  >
                    <Search className="h-4 w-4" />
                    <span className="sr-only">Search</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {headerActions}
          </div>
        </div>
      </Layout.Header>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
