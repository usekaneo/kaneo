import { useLocation, useNavigate } from "@tanstack/react-router";
import { CircleCheck, House, Inbox, Mail, Puzzle, Users } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import { usePlugins } from "@/lib/plugins/runtime/plugins-context";
import { selectContributions } from "@/lib/plugins/runtime/select-contributions";
import { usePluginLabel } from "@/lib/plugins/runtime/use-plugin-label";

type NavItem = {
  title: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: true }>;
  url: string;
  count?: number;
  emphasizeCount?: boolean;
};

export function NavMain() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const { data: invitations = [] } = usePendingInvitations();
  const { data: notifications = [] } = useGetNotifications(workspace?.id);
  const { data: assignedTasks } = useGetAssignedTasks(workspace?.id, true);

  const { plugins, workspaceId: pluginWorkspaceId } = usePlugins();
  const pluginLabel = usePluginLabel();

  if (!workspace) return null;

  const homeUrl = `/dashboard/workspace/${workspace.id}`;
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const navItems: NavItem[] = [
    { title: t("navigation:sidebar.home"), icon: House, url: homeUrl },
    {
      title: t("navigation:sidebar.inbox"),
      icon: Inbox,
      url: `${homeUrl}/inbox`,
      count: unreadCount,
      emphasizeCount: true,
    },
    {
      title: t("navigation:sidebar.myTasks"),
      icon: CircleCheck,
      url: `${homeUrl}/my-tasks`,
      count: assignedTasks?.total,
    },
    {
      title: t("navigation:sidebar.members"),
      icon: Users,
      url: `${homeUrl}/members`,
    },
    ...(pluginWorkspaceId === workspace.id
      ? selectContributions(plugins, "pages").map(({ scope, item }) => ({
          title: pluginLabel(scope.id, item.title),
          icon: item.icon ?? Puzzle,
          url: `/dashboard/workspace/${workspace.id}/plugin/${encodeURIComponent(scope.id)}/${encodeURIComponent(item.id)}`,
        }))
      : []),
  ];

  // Invitations to other workspaces only matter while one is waiting.
  if (invitations.length > 0) {
    navItems.push({
      title: t("navigation:sidebar.invitations"),
      icon: Mail,
      url: "/dashboard/invitations",
      count: invitations.length,
      emphasizeCount: true,
    });
  }

  return (
    <SidebarGroup className="gap-1 p-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.url}
                size="default"
                className="h-8 text-sm"
                onClick={() => navigate({ to: item.url })}
              >
                <item.icon aria-hidden />
                <span>{item.title}</span>
                {item.count ? (
                  <span
                    className={cn(
                      "ml-auto flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] tabular-nums",
                      item.emphasizeCount
                        ? "bg-foreground font-semibold text-background"
                        : "font-medium text-muted-foreground",
                    )}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
