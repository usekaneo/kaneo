import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Clock,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import useWorkspaceStore from "@/store/workspace";
import { Button } from "./ui/button";

export function NavMain() {
  const { workspace } = useWorkspaceStore();
  const navigate = useNavigate();

  if (!workspace) return null;

  const navItems = [
    {
      title: "Dashboard",
      url: `/dashboard/workspace/${workspace.id}`,
      icon: LayoutDashboard,
      isActive: false,
      isDisabled: false,
    },
    {
      title: "Search",
      url: `/dashboard/workspace/${workspace.id}/search`,
      icon: Search,
      isActive: false,
      isDisabled: false,
    },
    {
      title: "Time Tracking",
      url: `/dashboard/workspace/${workspace.id}/time`,
      icon: Clock,
      isActive: false,
      isDisabled: true,
    },
    {
      title: "Analytics",
      url: `/dashboard/workspace/${workspace.id}/analytics`,
      icon: BarChart3,
      isActive: false,
      isDisabled: true,
    },
    {
      title: "Team",
      url: `/dashboard/workspace/${workspace.id}/team`,
      icon: Users,
      isActive: false,
      isDisabled: false,
    },
    {
      title: "Settings",
      url: `/dashboard/workspace-settings/${workspace.id}`,
      icon: Settings,
      isActive: false,
      isDisabled: false,
    },
  ];

  const handleNavClick = (url: string) => {
    navigate({ to: url });
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Main</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              disabled={item.isDisabled}
            >
              <Button
                onClick={() => handleNavClick(item.url)}
                variant="ghost"
                className="w-full flex items-center gap-2 justify-start"
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                <span>{item.title}</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
