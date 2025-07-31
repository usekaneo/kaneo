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
import { shortcuts } from "@/constants/shortcuts";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { cn } from "@/lib/cn";
import useWorkspaceStore from "@/store/workspace";
import type { ProjectWithTasks } from "@/types/project";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Folder, Forward, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CreateProjectModal from "./shared/modals/create-project-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { KbdSequence } from "./ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function NavProjects() {
  const { isMobile } = useSidebar();
  const { workspace } = useWorkspaceStore();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id || "",
  });
  const queryClient = useQueryClient();
  const { mutateAsync: deleteProject } = useDeleteProject();
  const navigate = useNavigate();
  const { workspaceId: currentWorkspaceId, projectId: currentProjectId } =
    useParams({
      strict: false,
    });

  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] =
    useState(false);
  const [projectToDeleteId, setProjectToDeleteID] = useState<string | null>(
    null,
  );

  const isCurrentProject = (projectId: string) => {
    return (
      currentProjectId === projectId && currentWorkspaceId === workspace?.id
    );
  };

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
                    "w-full flex gap-2 justify-start items-start",
                    isCurrentProject(project.id) && "bg-accent",
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
                  <DropdownMenuItem
                    className="items-start cursor-pointer"
                    onClick={() => handleProjectClick(project)}
                  >
                    <Folder className="text-muted-foreground" />
                    <span>View Project</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="items-start cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/dashboard/workspace/${workspace?.id}/project/${project.id}`,
                      );
                      toast.success("Project link copied to clipboard");
                    }}
                  >
                    <Forward className="text-muted-foreground" />
                    <span>Share Project</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="items-start text-destructive cursor-pointer"
                    onClick={() => {
                      setProjectToDeleteID(project.id);
                      setIsDeleteProjectModalOpen(true);
                    }}
                  >
                    <Trash2 className="text-destructive" />
                    <span>Delete Project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
        <SidebarMenuItem>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton
                  className="text-sidebar-foreground/70"
                  onClick={() => setIsCreateProjectModalOpen(true)}
                >
                  <MoreHorizontal className="text-sidebar-foreground/70" />
                  <span>Add project</span>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent>
                <KbdSequence
                  keys={[shortcuts.project.prefix, shortcuts.project.create]}
                  className="ml-auto"
                />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenuItem>
      </SidebarMenu>
      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />

      <AlertDialog
        open={isDeleteProjectModalOpen}
        onOpenChange={setIsDeleteProjectModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the project and all its data. You
              can't undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteProject({
                  id: projectToDeleteId || "",
                });
                toast.success("Project deleted");
                queryClient.invalidateQueries({
                  queryKey: ["projects"],
                });
                navigate({
                  to: "/dashboard/workspace/$workspaceId",
                  params: {
                    workspaceId: workspace?.id || "",
                  },
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarGroup>
  );
}
