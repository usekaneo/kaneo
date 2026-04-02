import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { notificationMatchesWorkspace } from "@/components/notification/notification-utils";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useGetMyTasks from "@/hooks/queries/task/use-get-my-tasks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import { setDocumentAttentionCount } from "@/lib/document-title";

function formatSidebarBadgeCount(count: number) {
  if (count > 99) {
    return "99+";
  }

  return String(count);
}

export function NavMain() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const { data: invitations = [] } = usePendingInvitations();
  const workspaceId = workspace?.id ?? "";
  const { data: myTasks } = useGetMyTasks(workspaceId);
  const { data: notifications = [] } = useGetNotifications();

  const pendingCount = invitations.length;
  const pendingTaskCount = myTasks?.summary.pending ?? 0;
  const unreadNotificationCount = notifications.filter(
    (notification) =>
      !notification.isRead &&
      notificationMatchesWorkspace(notification, workspaceId),
  ).length;
  const totalAttentionCount = pendingTaskCount + unreadNotificationCount;

  const forYouItems = [
    {
      title: t("navigation:sidebar.myTasks"),
      url: `/dashboard/workspace/${workspaceId}/my-tasks`,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspaceId}/my-tasks`,
      badge: pendingTaskCount > 0 ? pendingTaskCount : null,
    },
    {
      title: t("navigation:sidebar.notifications"),
      url: `/dashboard/workspace/${workspaceId}/notifications`,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspaceId}/notifications`,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null,
    },
  ];

  const overviewItems = [
    {
      title: t("navigation:sidebar.projects"),
      url: `/dashboard/workspace/${workspaceId}`,
      isActive:
        window.location.pathname === `/dashboard/workspace/${workspaceId}`,
    },
    {
      title: t("navigation:sidebar.members"),
      url: `/dashboard/workspace/${workspaceId}/members`,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspaceId}/members`,
    },
    {
      title: t("navigation:sidebar.invitations"),
      url: "/dashboard/invitations",
      isActive: window.location.pathname === "/dashboard/invitations",
      badge: pendingCount > 0 ? pendingCount : null,
    },
  ];

  const isForYouActive = forYouItems.some((item) => item.isActive);
  const isOverviewActive = overviewItems.some((item) => item.isActive);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);

  useEffect(() => {
    setDocumentAttentionCount(totalAttentionCount);

    return () => {
      setDocumentAttentionCount(0);
    };
  }, [totalAttentionCount]);

  if (!workspace) return null;

  return (
    <SidebarGroup className="px-4 py-0">
      <SidebarGroupContent>
        <SidebarMenu className="gap-4">
          <SidebarMenuItem>
            <Collapsible defaultOpen={true} className="group/collapsible">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={isForYouActive}
                  className="h-9 px-2 text-[14px] font-semibold text-foreground/90 hover:text-foreground hover:bg-transparent transition-all"
                >
                  <span>{t("navigation:sidebar.forYou")}</span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <SidebarMenuSub className="mt-0.5 gap-0.5 border-none ml-0 p-0">
                  {forYouItems.map((item) => (
                    <SidebarMenuSubItem key={item.url}>
                      <SidebarMenuSubButton
                        isActive={item.isActive}
                        className={cn(
                          "h-9 px-3 text-[14px] transition-all duration-200 rounded-lg border-none",
                          item.isActive
                            ? "bg-muted font-semibold text-foreground"
                            : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/40",
                        )}
                        onClick={() => navigate({ to: item.url })}
                      >
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">
                            {formatSidebarBadgeCount(item.badge)}
                          </span>
                        )}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsiblePanel>
            </Collapsible>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <Collapsible
              open={isOverviewOpen}
              onOpenChange={setIsOverviewOpen}
              className="group/collapsible"
            >
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={isOverviewActive}
                  className="h-9 px-2 text-[14px] font-semibold text-foreground/90 hover:text-foreground hover:bg-transparent transition-all"
                >
                  <span>{t("navigation:sidebar.overview")}</span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <SidebarMenuSub className="mt-0.5 gap-0.5 border-none ml-0 p-0">
                  {overviewItems.map((item) => (
                    <SidebarMenuSubItem key={item.url}>
                      <SidebarMenuSubButton
                        isActive={item.isActive}
                        className={cn(
                          "h-9 px-3 text-[14px] transition-all duration-200 rounded-lg border-none",
                          item.isActive
                            ? "bg-muted font-semibold text-foreground"
                            : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/40",
                        )}
                        onClick={() => navigate({ to: item.url })}
                      >
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">
                            {formatSidebarBadgeCount(item.badge)}
                          </span>
                        )}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsiblePanel>
            </Collapsible>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
