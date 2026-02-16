import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, FolderKanban, Mail, Users } from "lucide-react";

import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export function NavMain() {
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const { data: invitations = [] } = usePendingInvitations();

  if (!workspace) return null;

  const pendingCount = invitations.length;

  const navItems = [
    {
      title: "Projects",
      url: `/dashboard/workspace/${workspace.id}`,
      icon: FolderKanban,
      isActive:
        window.location.pathname === `/dashboard/workspace/${workspace.id}`,
      isDisabled: false,
      badge: null,
    },
    {
      title: "Members",
      url: `/dashboard/workspace/${workspace.id}/members`,
      icon: Users,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/members`,
      isDisabled: false,
      badge: null,
    },
    {
      title: "Invitations",
      url: "/dashboard/invitations",
      icon: Mail,
      isActive: window.location.pathname === "/dashboard/invitations",
      isDisabled: false,
      badge: pendingCount > 0 ? pendingCount : null,
    },
  ];

  const handleNavClick = (url: string) => {
    navigate({ to: url });
  };

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="pt-2 pb-0">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="cursor-pointer px-2 text-sidebar-foreground/85 text-sm transition-colors duration-200 hover:text-sidebar-foreground" />
          }
        >
          <span>Workspace</span>
          <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <SidebarMenu className="space-y-0.5">
            {navItems.map((item, index) => (
              <SidebarMenuItem
                key={item.title}
                className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <SidebarMenuButton
                  tooltip={item.title}
                  disabled={item.isDisabled}
                  isActive={item.isActive}
                  size="default"
                  className="group h-9 rounded-md px-2.5 text-[15px] font-normal text-sidebar-foreground data-[active=true]:bg-sidebar-accent/70 data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium"
                  onClick={() => {
                    if (item.url) {
                      handleNavClick(item.url);
                    }
                  }}
                >
                  {item.icon && (
                    <item.icon className="h-4.5 w-4.5 opacity-90" />
                  )}
                  <span>{item.title}</span>
                  {item.badge !== null && (
                    <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-md bg-sidebar-accent px-1.5 text-xs font-medium text-sidebar-foreground">
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsiblePanel>
      </SidebarGroup>
    </Collapsible>
  );
}
