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
import { useState } from "react";
import SearchCommandMenu from "./search-command-menu";
import { SettingsMenu } from "./settings-menu";
import { Button } from "./ui/button";

export function NavMain() {
  const { workspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
      onClick: () => {
        setOpen(true);
      },
      icon: Search,
      isActive: false,
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
      title: "Members",
      url: `/dashboard/workspace/${workspace.id}/members`,
      icon: Users,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/members`,
      isDisabled: false,
    },
  ];

  const handleNavClick = (url: string) => {
    navigate({ to: url });
  };

  return (
    <>
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
                  onClick={() => {
                    if (item.url) {
                      handleNavClick(item.url);
                    } else {
                      item.onClick?.();
                    }
                  }}
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
      <SearchCommandMenu open={open} setOpen={setOpen} />
    </>
  );
}
