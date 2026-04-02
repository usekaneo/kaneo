import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronRight,
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
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
import { Button } from "./ui/button";

export function NavProjects() {
  const { t } = useTranslation();
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
    <>
      <SidebarGroup className="px-4 py-0">
        <SidebarGroupContent>
          <SidebarMenu className="gap-2">
            <SidebarMenuItem>
              <Collapsible defaultOpen={true} className="group/collapsible">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="h-9 px-2 text-[14px] font-semibold text-foreground/90 hover:text-foreground hover:bg-transparent transition-all">
                    <span>{t("navigation:sidebar.projects")}</span>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsiblePanel>
                  <SidebarMenuSub className="mt-0.5 gap-0.5 border-none ml-0 p-0">
                    {projects?.map((project) => {
                      const isActive = isCurrentProject(project.id);
                      return (
                        <SidebarMenuSubItem key={project.id}>
                          <SidebarMenuSubButton
                            isActive={isActive}
                            className={cn(
                              "h-9 px-3 text-[14px] transition-all duration-200 rounded-lg border-none",
                              isActive
                                ? "bg-muted font-semibold text-foreground"
                                : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/40",
                            )}
                            onClick={() => handleProjectClick(project)}
                          >
                            <span>{project.name}</span>
                          </SidebarMenuSubButton>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  className="absolute top-1.5 right-1.5 flex aspect-square w-6 items-center justify-center rounded-lg p-0 text-sidebar-foreground/40 outline-hidden ring-sidebar-ring transition-all hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 peer-hover/menu-sub-button:text-sidebar-foreground group-focus-within/menu-sub-item:opacity-100 group-hover/menu-sub-item:opacity-100 data-[state=open]:opacity-100 opacity-0"
                                />
                              }
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                              <span className="sr-only">
                                {t("navigation:sidebar.more")}
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              className="w-48 rounded-xl"
                              side={isMobile ? "bottom" : "right"}
                              align={isMobile ? "end" : "start"}
                            >
                              <DropdownMenuItem
                                className="h-9 items-center cursor-pointer text-sm rounded-lg"
                                onClick={() => handleProjectClick(project)}
                              >
                                <Folder className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {t("navigation:projectList.viewProject")}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="h-9 items-center cursor-pointer text-sm rounded-lg"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/dashboard/workspace/${workspace?.id}/project/${project.id}`,
                                  );
                                  toast.success(
                                    t("navigation:projectList.linkCopied"),
                                  );
                                }}
                              >
                                <Forward className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {t("navigation:projectList.shareProject")}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="h-9 items-center text-destructive cursor-pointer text-sm hover:bg-destructive/10 rounded-lg"
                                onClick={() => {
                                  setProjectToDeleteID(project.id);
                                  setIsDeleteProjectModalOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span>
                                  {t("navigation:projectList.deleteProject")}
                                </span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuSubItem>
                      );
                    })}

                    <SidebarMenuSubItem className="mt-1">
                      <SidebarMenuSubButton
                        size="md"
                        render={<button type="button" />}
                        className="h-9 px-3 text-[14px] text-muted-foreground/60 transition-all duration-200 rounded-lg hover:text-foreground hover:bg-muted/40"
                        onClick={() => setIsCreateProjectModalOpen(true)}
                      >
                        <span>{t("navigation:projectList.addProject")}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsiblePanel>
              </Collapsible>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
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
            <AlertDialogTitle>
              {t("navigation:projectList.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("navigation:projectList.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose
              onClick={async () => {
                await deleteProject({
                  id: projectToDeleteId || "",
                });
                toast.success(t("navigation:projectList.deletedToast"));
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
            >
              <Button variant="destructive" size="sm">
                {t("navigation:projectList.deleteProject")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
