import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronRight,
  Folder,
  Forward,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
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
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import type { ProjectWithTasks } from "@/types/project";
import CreateProjectModal from "./shared/modals/create-project-modal";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function NavProjects() {
  const { isMobile } = useSidebar();
  const { data: workspace } = useActiveWorkspace();
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
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden pt-0">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="cursor-pointer px-2 text-sidebar-foreground/85 text-sm transition-colors duration-200 hover:text-sidebar-foreground flex items-center justify-between" />
          }
        >
          <span>Projects</span>
          <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsiblePanel className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200">
          <SidebarMenu className="space-y-0">
            {projects?.map((project, index) => {
              const IconComponent =
                icons[project.icon as keyof typeof icons] || icons.Layout;

              return (
                <SidebarMenuItem
                  key={project.id}
                  className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 duration-200"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <SidebarMenuButton
                    isActive={isCurrentProject(project.id)}
                    size="default"
                    className="h-9 rounded-md px-2.5 text-[15px] font-normal text-sidebar-foreground data-[active=true]:bg-sidebar-accent/70 data-[active=true]:font-medium"
                    onClick={() => handleProjectClick(project)}
                  >
                    <IconComponent className="h-4.5 w-4.5 opacity-90" />
                    <span>{project.name}</span>
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
                        className="h-8 items-start cursor-pointer text-sm"
                        onClick={() => handleProjectClick(project)}
                      >
                        <Folder className="text-muted-foreground" />
                        <span>View Project</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="h-8 items-start cursor-pointer text-sm"
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
                        className="h-8 items-start text-destructive cursor-pointer text-sm"
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
            <SidebarMenuItem
              className="mt-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 duration-200"
              style={{ animationDelay: `${(projects?.length || 0) * 50}ms` }}
            >
              <SidebarMenuButton
                size="default"
                className="h-9 rounded-md px-2.5 text-[15px] font-normal text-sidebar-foreground/95 hover:text-sidebar-foreground"
                onClick={() => setIsCreateProjectModalOpen(true)}
              >
                <Plus className="h-4.5 w-4.5 opacity-90" />
                <span>Add project</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </CollapsiblePanel>
      </SidebarGroup>
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
            <AlertDialogClose>Cancel</AlertDialogClose>
            <AlertDialogClose
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
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
