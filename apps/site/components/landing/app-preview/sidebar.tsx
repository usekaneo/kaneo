import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  House,
  Inbox,
  type LucideIcon,
  MoreHorizontal,
  Plus,
  SearchIcon,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ProjectWithTasks } from "@/types/project";
import messages from "../../../../../i18n/en-US.json";
import { version } from "../../../../../package.json";
import { getCompletionPercentage } from "./assigned-tasks";
import { CURRENT_USER, MOCK_WORKSPACE } from "./mock-data";
import { getProjectIcon } from "./project-icon";
import { ProjectProgress } from "./project-progress";

export type PreviewPage = "home" | "inbox" | "my-tasks";

type NavItem = {
  page?: PreviewPage;
  title: string;
  icon: LucideIcon;
  count?: number;
  emphasizeCount?: boolean;
};

const sidebarCopy = messages.navigation.sidebar;
const initials = CURRENT_USER.name
  .split(" ")
  .map((name) => name[0])
  .join("");

// Visually identical to apps/web's app-sidebar, driven by mock data.
export function PreviewSidebar({
  projects,
  activePage,
  activeProjectId,
  unreadCount,
  assignedCount,
  onPageSelect,
  onProjectSelect,
}: {
  projects: ProjectWithTasks[];
  activePage: PreviewPage | null;
  activeProjectId: string;
  unreadCount: number;
  assignedCount: number;
  onPageSelect: (page: PreviewPage) => void;
  onProjectSelect: (id: string) => void;
}) {
  const navItems: NavItem[] = [
    { page: "home", title: sidebarCopy.home, icon: House },
    {
      page: "inbox",
      title: sidebarCopy.inbox,
      icon: Inbox,
      count: unreadCount,
      emphasizeCount: true,
    },
    {
      page: "my-tasks",
      title: sidebarCopy.myTasks,
      icon: CircleCheck,
      count: assignedCount,
    },
    { title: sidebarCopy.members, icon: Users },
  ];

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      className="border-none pt-1.5"
    >
      <SidebarHeader className="pt-1 pb-1.5">
        <div className="flex w-full items-center justify-between gap-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      className="group h-8 w-full rounded-md px-2 text-sidebar-foreground data-[active=true]:bg-sidebar-accent/50"
                      size="default"
                    />
                  }
                >
                  <div className="flex w-full min-w-0 items-center">
                    <span className="truncate text-sm font-medium text-foreground">
                      {MOCK_WORKSPACE.name}
                    </span>
                  </div>
                  <ChevronDown className="ml-1 size-3.5 text-foreground/70 opacity-90 transition-[rotate,opacity] duration-200 ease-out group-hover:opacity-100" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="min-w-40 text-sidebar-foreground"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      {messages.navigation.workspaceSwitcher.workspaces}
                    </DropdownMenuLabel>
                    <DropdownMenuItem className="h-7 text-sm data-highlighted:bg-sidebar-accent">
                      {MOCK_WORKSPACE.name}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem className="h-7 text-sm data-highlighted:bg-sidebar-accent">
                      {messages.navigation.workspaceSwitcher.addWorkspace}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="flex items-center gap-0.5">
            <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
              <SearchIcon aria-hidden="true" className="size-4" />
            </span>
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="border border-border/30 text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 overflow-hidden py-1">
        <SidebarGroup className="gap-1 p-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    data-tour-target={item.page}
                    isActive={
                      item.page !== undefined && item.page === activePage
                    }
                    size="default"
                    className={cn(
                      "h-8 text-sm",
                      !item.page &&
                        "cursor-default hover:bg-transparent active:bg-transparent",
                    )}
                    onClick={() => item.page && onPageSelect(item.page)}
                  >
                    <item.icon aria-hidden="true" />
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
                        {item.count}
                      </span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible defaultOpen>
          <SidebarGroup className="gap-1 p-2 pt-1">
            <CollapsibleTrigger
              nativeButton={false}
              className="data-panel-open:[&_svg]:rotate-90"
              render={
                <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-0 text-sidebar-accent-foreground" />
              }
            >
              <span>{sidebarCopy.projects}</span>
              <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
            </CollapsibleTrigger>
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 flex aspect-square w-5 items-center justify-center text-sidebar-foreground/70 [&>svg]:size-4"
            >
              <Plus />
            </span>
            <CollapsiblePanel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {projects.map((project) => {
                    const ProjectIcon = getProjectIcon(project.icon);
                    return (
                      <SidebarMenuItem key={project.id}>
                        <SidebarMenuButton
                          data-tour-target={
                            project.id === projects[0]?.id
                              ? "project-main"
                              : "project-other"
                          }
                          isActive={
                            activePage === null &&
                            project.id === activeProjectId
                          }
                          size="default"
                          className="h-8 text-sm"
                          onClick={() => onProjectSelect(project.id)}
                        >
                          <ProjectIcon aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {project.name}
                          </span>
                          <ProjectProgress
                            percentage={getCompletionPercentage(project)}
                            className="text-muted-foreground group-hover/menu-item:opacity-0"
                          />
                        </SidebarMenuButton>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1.5 right-1 flex size-5 items-center justify-center opacity-0 group-hover/menu-item:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </span>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsiblePanel>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu className="gap-0.5">
          {[
            { title: sidebarCopy.invitePeople, icon: UserPlus },
            { title: messages.navigation.userMenu.settings, icon: Settings },
          ].map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                size="default"
                className="h-8 cursor-default text-sm hover:bg-transparent active:bg-transparent"
              >
                <item.icon aria-hidden="true" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="flex items-center justify-center px-2 py-1.5">
          <span className="text-xs text-muted-foreground">v{version}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
