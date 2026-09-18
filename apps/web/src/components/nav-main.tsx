import { useNavigate } from "@tanstack/react-router";
import {
  CalendarCheck,
  ChevronRight,
  Clock,
  FolderKanban,
  FolderOpen,
  House,
  Mail,
  MessagesSquare,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useChatConversations } from "@/hooks/chat";
import { useOpenRequests } from "@/hooks/queries/company-os";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function NavMain() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const { data: invitations = [] } = usePendingInvitations();
  const { canSeePay, canApproveRequests } = useWorkspacePermission();
  const { data: openRequests } = useOpenRequests(
    workspace?.id,
    Boolean(canApproveRequests()),
  );
  const { data: conversations = [] } = useChatConversations(workspace?.id);

  if (!workspace) return null;

  const pendingCount = invitations.length;
  const chatUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const pendingLeave = openRequests?.leave.length ?? 0;

  const base = `/dashboard/workspace/${workspace.id}`;
  const navItems = [
    {
      icon: House,
      title: t("navigation:sidebar.myWork"),
      url: `${base}/my-work`,
      isActive: window.location.pathname === `${base}/my-work`,
      badge: null,
    },
    {
      icon: FolderKanban,
      title: t("navigation:sidebar.projects"),
      url: `/dashboard/workspace/${workspace.id}`,
      isActive:
        window.location.pathname === `/dashboard/workspace/${workspace.id}`,
      badge: null,
    },
    {
      icon: Users,
      title: t("navigation:sidebar.people"),
      url: `/dashboard/workspace/${workspace.id}/people`,
      isActive: window.location.pathname.startsWith(
        `/dashboard/workspace/${workspace.id}/people`,
      ),
      badge: null,
    },
    {
      icon: Clock,
      title: t("navigation:sidebar.time"),
      url: `/dashboard/workspace/${workspace.id}/time`,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/time`,
      badge: null,
    },
    {
      icon: CalendarCheck,
      title: t("navigation:sidebar.attendance"),
      url: `${base}/attendance`,
      isActive: window.location.pathname === `${base}/attendance`,
      badge: pendingLeave > 0 ? pendingLeave : null,
    },
    {
      icon: MessagesSquare,
      title: t("navigation:sidebar.chat"),
      url: `${base}/chat`,
      isActive: window.location.pathname === `${base}/chat`,
      badge: chatUnread > 0 ? chatUnread : null,
    },
    {
      icon: FolderOpen,
      title: t("navigation:sidebar.files"),
      url: `${base}/files`,
      isActive: window.location.pathname === `${base}/files`,
      badge: null,
    },
    ...(canSeePay()
      ? [
          {
            icon: Wallet,
            title: t("navigation:sidebar.payroll"),
            url: `${base}/payroll`,
            isActive: window.location.pathname.startsWith(`${base}/payroll`),
            badge: null,
          },
        ]
      : []),
    {
      icon: Mail,
      title: t("navigation:sidebar.invitations"),
      url: "/dashboard/invitations",
      isActive: window.location.pathname === "/dashboard/invitations",
      badge: pendingCount > 0 ? pendingCount : null,
    },
  ];

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="gap-1 p-2">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="h-7 cursor-pointer justify-between px-0 text-sidebar-accent-foreground" />
          }
        >
          <span>{t("navigation:sidebar.overview")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={item.isActive}
                    size="default"
                    className="h-8 gap-2.5 ps-3 text-sm hover:bg-transparent hover:text-sidebar-accent-foreground active:bg-transparent [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-foreground/60 data-[active=true]:[&>svg]:text-sidebar-accent-foreground"
                    onClick={() => navigate({ to: item.url })}
                  >
                    <item.icon aria-hidden />
                    <span>{item.title}</span>
                    {item.badge !== null && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-sm border border-sidebar-border/60 px-1 text-[11px] font-medium text-sidebar-foreground/80">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </SidebarGroup>
    </Collapsible>
  );
}
