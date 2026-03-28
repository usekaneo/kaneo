import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { Eye, GitBranch, Plug, Settings } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, role } = useWorkspacePermission();
  const location = useLocation();
  const navigate = useNavigate();
  const menuItems = [
    {
      title: t("settings:projectGeneral.title"),
      icon: Settings,
      segment: "general",
    },
    {
      title: t("settings:projectVisibility.title"),
      icon: Eye,
      segment: "visibility",
    },
    {
      title: t("settings:projectIntegrations.title"),
      icon: Plug,
      segment: "integrations",
    },
    {
      title: t("settings:projectWorkflow.title"),
      icon: GitBranch,
      segment: "workflow",
    },
  ];
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id || "",
  });

  const workspaceInitials =
    workspace?.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "WS";

  const selectedProjectMatch = location.pathname.match(
    /^\/dashboard\/settings\/projects\/([^/]+)\//,
  );
  const selectedProjectId = selectedProjectMatch?.[1] || "";
  const selectedSegment =
    location.pathname.match(
      /^\/dashboard\/settings\/projects\/[^/]+\/([^/]+)/,
    )?.[1] || "general";

  useEffect(() => {
    const isProjectsRoot =
      location.pathname === "/dashboard/settings/projects" ||
      location.pathname === "/dashboard/settings/projects/";

    if (!isProjectsRoot || !projects || projects.length === 0) {
      return;
    }

    void navigate({
      to: "/dashboard/settings/projects/$projectId/general",
      params: { projectId: projects[0].id },
      replace: true,
    });
  }, [location.pathname, navigate, projects]);

  const selectedProject = projects?.find(
    (project) => project.id === selectedProjectId,
  );

  return (
    <div className="flex gap-6 h-full">
      <aside className="w-64 flex-shrink-0">
        <div className="p-2">
          <div className="mb-1 flex items-center gap-3 rounded-md px-2 py-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={workspace?.logo ?? ""}
                alt={workspace?.name || ""}
              />
              <AvatarFallback className="border border-sidebar-border/70 bg-sidebar-accent/70 text-[11px] font-medium text-sidebar-accent-foreground">
                {workspaceInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm">{workspace?.name}</p>
              <p className="text-[11px] text-sidebar-foreground/60 capitalize">
                {t(`team:roles.${role}`, { defaultValue: role })}
              </p>
            </div>
          </div>

          <SidebarGroup className="gap-1 p-1">
            <SidebarGroupLabel className="h-7 px-2 text-[11px] uppercase tracking-wide text-sidebar-foreground/70">
              {t("navigation:projectSettings.projectLabel")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <Select
                value={selectedProjectId}
                onValueChange={(projectId) => {
                  const nextSegment = menuItems.some(
                    (item) => item.segment === selectedSegment,
                  )
                    ? selectedSegment
                    : "general";

                  void navigate({
                    to: `/dashboard/settings/projects/${projectId}/${nextSegment}`,
                  });
                }}
              >
                <SelectTrigger
                  className="h-8 text-[11px] font-normal text-foreground"
                  size="sm"
                >
                  <span className="truncate font-normal text-foreground">
                    {selectedProject?.name ||
                      (projects?.length
                        ? t("settings:projectSwitcher.selectProject")
                        : t("settings:projectSwitcher.noProjects"))}
                  </span>
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignItemWithTrigger={false}
                  className="w-(--anchor-width)"
                >
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="font-normal text-foreground">
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="gap-1 p-1">
            <SidebarGroupLabel className="h-7 px-2 text-[11px] uppercase tracking-wide text-sidebar-foreground/70">
              {t("navigation:page.settingsTitle")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {menuItems.map((item) => {
                  const toUrl = selectedProject
                    ? `/dashboard/settings/projects/${selectedProject.id}/${item.segment}`
                    : "/dashboard/settings/projects";
                  const isActive = selectedSegment === item.segment;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <Button
                        render={<Link to={toUrl} />}
                        variant="ghost"
                        size="sm"
                        disabled={!selectedProject}
                        className={cn(
                          "h-8 w-full justify-start gap-2 rounded-lg px-2 text-[11px] font-normal text-sidebar-foreground/80",
                          isActive &&
                            "bg-sidebar-accent text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        <span>{item.title}</span>
                      </Button>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
