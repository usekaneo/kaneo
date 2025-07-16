import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import icons from "@/constants/project-icons";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import type { ProjectWithTasks } from "@/types/project";
import { useNavigate } from "@tanstack/react-router";
import { Folder, Forward, MoreHorizontal, Trash2 } from "lucide-react";

export function NavProjects() {
  const { isMobile } = useSidebar();
  const { workspace } = useWorkspaceStore();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id || "",
  });
  const { project: currentProject } = useProjectStore();
  const navigate = useNavigate();

  const handleProjectClick = (project: ProjectWithTasks) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        workspaceId: workspace?.id || "",
        projectId: project.id,
      },
    });
  };

  if (!workspace) return null;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects?.map((project) => {
          const IconComponent =
            icons[project.icon as keyof typeof icons] || icons.Layout;
          return (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton asChild>
                <Button
                  onClick={() => handleProjectClick(project)}
                  variant="ghost"
                  className={cn(
                    "w-full flex items-center gap-2 justify-start",
                    project.id === currentProject?.id && "bg-accent",
                  )}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{project.name}</span>
                </Button>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem onClick={() => handleProjectClick(project)}>
                    <Folder className="text-muted-foreground" />
                    <span>View Project</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Forward className="text-muted-foreground" />
                    <span>Share Project</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Trash2 className="text-muted-foreground" />
                    <span>Delete Project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
        <SidebarMenuItem>
          <SidebarMenuButton
            className="text-sidebar-foreground/70"
            onClick={() => {
              // TODO: Open create project modal
              console.log("Create project");
            }}
          >
            <MoreHorizontal className="text-sidebar-foreground/70" />
            <span>Add project</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
