import { useNavigate, useParams } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Clock,
  LayoutDashboard,
  LayoutGrid,
  Search,
  Users,
} from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function NavMain() {
  const { workspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { workspaceId: currentWorkspaceId, projectId: currentProjectId } =
    useParams({
      strict: false,
    });

  if (!workspace) return null;

  const isInProject = currentProjectId && currentWorkspaceId === workspace.id;
  const currentPath = window.location.pathname;
  const isBoard = currentPath.includes("/board");
  const isBacklog = currentPath.includes("/backlog");

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

  const handleViewChange = (view: "board" | "backlog") => {
    if (!currentProjectId) return;
    navigate({
      to: `/dashboard/workspace/$workspaceId/project/$projectId/${view}`,
      params: {
        workspaceId: workspace.id,
        projectId: currentProjectId,
      },
    });
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

          {isInProject && (
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full flex items-center gap-2 justify-between",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isBoard ? (
                        <LayoutGrid className="w-4 h-4" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                      <span>View</span>
                    </div>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem
                    onClick={() => handleViewChange("board")}
                    className={cn("cursor-pointer", isBoard && "bg-accent")}
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Active Board
                    {isBoard && (
                      <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleViewChange("backlog")}
                    className={cn("cursor-pointer", isBacklog && "bg-accent")}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Backlog
                    {isBacklog && (
                      <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          )}

          <SidebarMenuItem>
            <SettingsMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SearchCommandMenu open={open} setOpen={setOpen} />
    </>
  );
}
