import { useNavigate } from "@tanstack/react-router";
import { FolderKanban, Users } from "lucide-react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import useWorkspaceStore from "@/store/workspace";
import { Button } from "./ui/button";

export function NavMain() {
  const { workspace } = useWorkspaceStore();
  const navigate = useNavigate();

  if (!workspace) return null;

  const navItems = [
    {
      title: "Projects",
      url: `/dashboard/workspace/${workspace.id}`,
      icon: FolderKanban,
      isActive:
        window.location.pathname === `/dashboard/workspace/${workspace.id}`,
      isDisabled: false,
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
      <SidebarGroup className="py-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                disabled={item.isDisabled}
                isActive={item.isActive}
                size="sm"
                className="h-7 px-2 text-xs rounded-sm"
              >
                <Button
                  onClick={() => {
                    if (item.url) {
                      handleNavClick(item.url);
                    }
                  }}
                  variant="ghost"
                  className={cn(
                    "w-full h-7 justify-start items-center gap-2 px-2 text-xs font-normal transition-all duration-200 relative",
                    item.isActive &&
                      "before:absolute before:inset-0 before:bg-gradient-to-r before:from-accent before:to-accent/0 before:rounded-l-sm before:pointer-events-none border-r-2 border-primary after:absolute after:top-0 after:right-0 after:bottom-0 after:w-2 after:bg-gradient-to-l after:from-primary/20 after:to-transparent after:pointer-events-none",
                  )}
                >
                  {item.icon && (
                    <item.icon className="w-3.5 h-3.5 transition-colors duration-200 relative z-10" />
                  )}
                  <span className="transition-colors duration-200 relative z-10">
                    {item.title}
                  </span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
