import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, FolderKanban, Mail, Users } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
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
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";

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
    <Collapsible defaultOpen={true} className="group/collapsible">
      <SidebarGroup className="pt-2 pb-0">
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="px-2 text-xs text-muted-foreground/70 font-medium cursor-pointer hover:text-muted-foreground transition-colors duration-200 flex items-center justify-between">
            Workspace
            <ChevronRight className="ml-auto h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200">
          <SidebarMenu className="space-y-0.5">
            {navItems.map((item, index) => (
              <SidebarMenuItem
                key={item.title}
                className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  disabled={item.isDisabled}
                  isActive={item.isActive}
                  size="sm"
                  className="h-7 px-2 text-xs rounded-sm group text-foreground/60"
                >
                  <Button
                    onClick={() => {
                      if (item.url) {
                        handleNavClick(item.url);
                      }
                    }}
                    variant="ghost"
                    className={cn(
                      "w-full h-7 justify-start items-center gap-2 px-2 text-sm transition-all duration-200 relative",
                      item.isActive && "bg-neutral-200! dark:bg-neutral-800!",
                    )}
                  >
                    {item.icon && (
                      <item.icon className="w-3.5 h-3.5 transition-colors duration-200 relative z-10" />
                    )}
                    <span className="transition-colors duration-200 relative z-10">
                      {item.title}
                    </span>
                    {item.badge !== null && (
                      <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/90 px-1 text-[9px] font-medium text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
