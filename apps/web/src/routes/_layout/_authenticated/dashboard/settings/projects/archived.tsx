import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArchiveRestore, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import icons from "@/constants/project-icons";
import useUnarchiveProject from "@/hooks/mutations/project/use-unarchive-project";
import useGetArchivedProjects from "@/hooks/queries/project/use-get-archived-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/archived",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { workspace, canManageProjects } = useWorkspacePermission();
  const { data: activeWorkspace } = useActiveWorkspace();
  const workspaceId = workspace?.id || activeWorkspace?.id || "";

  const { data: archivedProjects } = useGetArchivedProjects({ workspaceId });
  const { mutateAsync: unarchiveProject } = useUnarchiveProject();

  return (
    <>
      <PageTitle title="Archived Projects" />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Archived Projects</h1>
          <p className="text-muted-foreground">
            Archived projects are hidden from the sidebar but remain accessible.
          </p>
        </div>

        <div className="space-y-2 border border-border rounded-md bg-sidebar p-4">
          {!archivedProjects?.length ? (
            <p className="text-sm text-muted-foreground">
              No archived projects in this workspace.
            </p>
          ) : (
            <div className="space-y-2">
              {archivedProjects.map((project) => {
                const Icon =
                  icons[project.icon as keyof typeof icons] || icons.Layout;

                const archivedAt = project.archivedAt
                  ? new Date(project.archivedAt).toLocaleString()
                  : null;

                return (
                  <div
                    key={project.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background p-3"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-sidebar">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {project.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {archivedAt ? `Archived ${archivedAt}` : "Archived"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigate({
                            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
                            params: {
                              workspaceId,
                              projectId: project.id,
                            },
                          });
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        View
                      </Button>

                      {canManageProjects() && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            try {
                              await unarchiveProject({
                                id: project.id,
                                workspaceId,
                              });
                              toast.success("Project unarchived");
                              await Promise.all([
                                queryClient.invalidateQueries({
                                  queryKey: ["projects"],
                                }),
                                queryClient.invalidateQueries({
                                  queryKey: ["projects", workspaceId],
                                }),
                                queryClient.invalidateQueries({
                                  queryKey: [
                                    "projects",
                                    workspaceId,
                                    "archived",
                                  ],
                                }),
                              ]);
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Failed to unarchive project",
                              );
                            }
                          }}
                        >
                          <ArchiveRestore className="h-4 w-4" />
                          Unarchive
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
