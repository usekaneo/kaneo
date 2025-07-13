import Layout from "@/components/common/layout";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import useClearNotifications from "@/hooks/mutations/notification/use-clear-notifications";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useGetWorkspace from "@/hooks/queries/workspace/use-get-workspace";
import { cn } from "@/lib/cn";
import useWorkspaceStore from "@/store/workspace";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bell, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard/workspace/$workspaceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data: workspace } = useGetWorkspace({ id: workspaceId });
  const { data: notifications } = useGetNotifications();
  const { setWorkspace } = useWorkspaceStore();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead();
  const { mutate: clearAll } = useClearNotifications();

  useEffect(() => {
    if (workspace) {
      setWorkspace(workspace);
    }
  }, [workspace, setWorkspace]);

  const unreadNotifications = notifications?.filter((n) => !n.isRead) || [];

  return (
    <>
      <Layout>
        <Layout.Header>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4"
              />
              <h1 className="text-lg font-semibold text-card-foreground">
                Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu
                open={isNotificationsOpen}
                onOpenChange={setIsNotificationsOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="w-4 h-4" />
                    {unreadNotifications.length > 0 && (
                      <Badge
                        badgeColor="red"
                        className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
                      >
                        {unreadNotifications.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="flex items-center justify-between p-3 border-b">
                    <h3 className="font-medium">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadNotifications.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => markAllAsRead()}
                        >
                          Mark all read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearAll()}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications && notifications.length > 0 ? (
                      notifications.slice(0, 10).map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="p-3 flex-col items-start"
                        >
                          <div className="flex items-start gap-2 w-full">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                                !notification.isRead
                                  ? "bg-indigo-600"
                                  : "bg-sidebar-border",
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-sidebar-foreground truncate">
                                {notification.title}
                              </p>
                              {notification.content && (
                                <p className="text-xs text-sidebar-foreground/70 mt-1">
                                  {notification.content}
                                </p>
                              )}
                              <p className="text-xs text-sidebar-foreground/50 mt-1">
                                {formatDistanceToNow(
                                  new Date(notification.createdAt),
                                  { addSuffix: true },
                                )}
                              </p>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="p-6 text-center">
                        <Bell className="w-8 h-8 text-sidebar-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-sidebar-foreground/70">
                          No notifications
                        </p>
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateProjectOpen(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </div>
          </div>
        </Layout.Header>
        <Layout.Content>
          <div>To be added!</div>
        </Layout.Content>
      </Layout>

      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />

      <Outlet />
    </>
  );
}
