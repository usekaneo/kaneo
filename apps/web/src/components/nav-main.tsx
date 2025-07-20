import { useNavigate } from "@tanstack/react-router";
import { BarChart3, Clock, LayoutDashboard, Search, Users } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import useWorkspaceStore from "@/store/workspace";
import { SettingsMenu } from "./settings-menu";
import { Button } from "./ui/button";

export function NavMain() {
  const { workspace } = useWorkspaceStore();
  const navigate = useNavigate();

  if (!workspace) return null;

  const navItems = [
    {
      title: "Projects",
      url: `/dashboard/workspace/${workspace.id}`,
      icon: LayoutDashboard,
      isActive:
        window.location.pathname === `/dashboard/workspace/${workspace.id}`,
      isDisabled: false,
    },
    {
      title: "Search",
      url: `/dashboard/workspace/${workspace.id}/search`,
      icon: Search,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/search`,
      isDisabled: false,
    },
    {
      title: "Time Tracking",
      url: `/dashboard/workspace/${workspace.id}/time`,
      icon: Clock,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/time`,
      isDisabled: true,
    },
    {
      title: "Analytics",
      url: `/dashboard/workspace/${workspace.id}/analytics`,
      icon: BarChart3,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/analytics`,
      isDisabled: true,
    },
    {
      title: "Team",
      url: `/dashboard/workspace/${workspace.id}/team`,
      icon: Users,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/team`,
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
              className="w-full flex gap-2 justify-start items-start"
            >
              <Button
                onClick={() => handleNavClick(item.url)}
                variant="ghost"
                className={cn("w-full", item.isActive && "bg-accent")}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                <span>{item.title}</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SettingsMenu />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
