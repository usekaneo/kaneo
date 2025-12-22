import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  LayoutGrid,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import icons from "@/constants/project-icons";
import { shortcuts } from "@/constants/shortcuts";
import useArchiveProject from "@/hooks/mutations/project/use-archive-project";
import useUnarchiveProject from "@/hooks/mutations/project/use-unarchive-project";
import useGetArchivedProjects from "@/hooks/queries/project/use-get-archived-projects";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    const view = search.view;
    if (view === "archived" || view === "all" || view === "active") {
      return { view };
    }
    return { view: "active" };
  },
});

type ProjectView = "active" | "archived" | "all";

function RouteComponent() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { view } = Route.useSearch() as { view: ProjectView };

  const showActiveProjects = view === "active" || view === "all";
  const showArchivedProjects = view === "archived" || view === "all";

  const { data: activeProjects, isLoading: isActiveLoading } = useGetProjects({
    workspaceId,
    enabled: showActiveProjects,
  });
  const { data: archivedProjects, isLoading: isArchivedLoading } =
    useGetArchivedProjects({
      workspaceId,
      enabled: showArchivedProjects,
    });

  const { mutateAsync: archiveProject } = useArchiveProject();
  const { mutateAsync: unarchiveProject } = useUnarchiveProject();

  const projects =
    view === "archived"
      ? (archivedProjects ?? [])
      : view === "all"
        ? [...(activeProjects ?? []), ...(archivedProjects ?? [])]
        : (activeProjects ?? []);

  const isLoading =
    (showActiveProjects && isActiveLoading) ||
    (showArchivedProjects && isArchivedLoading);

  const handleCreateProject = () => {
    setIsCreateProjectOpen(true);
  };

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.project.prefix]: {
        [shortcuts.project.create]: handleCreateProject,
      },
    },
  });

  const handleProjectClick = (projectId: string) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: { workspaceId, projectId },
    });
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Tabs
        value={view}
        onValueChange={(nextValue) => {
          const nextView = nextValue as ProjectView;
          navigate({
            to: "/dashboard/workspace/$workspaceId",
            params: { workspaceId },
            search: (prev) => ({
              ...prev,
              view: nextView === "active" ? undefined : nextView,
            }),
          });
        }}
      >
        <TabsList className="h-8">
          <TabsTrigger value="active" className="text-xs">
            Active
          </TabsTrigger>
          <TabsTrigger value="archived" className="text-xs">
            Archived
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        variant="outline"
        size="xs"
        onClick={handleCreateProject}
        className="gap-1"
      >
        <Plus className="w-3 h-3" />
        Create project
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <>
        <PageTitle title="Projects" />
        <WorkspaceLayout title="Projects" headerActions={headerActions}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground font-medium">
                  Title
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  Progress
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  Target date
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  Status
                </TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-2 w-20" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WorkspaceLayout>
      </>
    );
  }

  if (projects.length === 0) {
    const emptyState =
      view === "archived"
        ? {
            title: "No archived projects",
            description:
              "Archived projects will show up here. You can still access them any time.",
            action: null,
          }
        : {
            title: "No projects yet",
            description: "Get started by creating your first project.",
            action: (
              <Button
                onClick={handleCreateProject}
                className="gap-2 text-white"
              >
                <Plus className="w-4 h-4" />
                Create project
              </Button>
            ),
          };

    return (
      <>
        <PageTitle title="Projects" />
        <WorkspaceLayout title="Projects" headerActions={headerActions}>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-xl bg-muted flex items-center justify-center">
                <LayoutGrid className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{emptyState.title}</h3>
                <p className="text-muted-foreground">
                  {emptyState.description}
                </p>
              </div>
              {emptyState.action}
            </div>
          </div>
        </WorkspaceLayout>

        <CreateProjectModal
          open={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <PageTitle title="Projects" />
      <WorkspaceLayout title="Projects" headerActions={headerActions}>
        <Table>
          <TableHeader className="p-4">
            <TableRow>
              <TableHead className="text-foreground font-medium">
                Title
              </TableHead>
              <TableHead className="text-foreground font-medium">
                Progress
              </TableHead>
              <TableHead className="text-foreground font-medium">
                Due date
              </TableHead>
              <TableHead className="text-foreground font-medium">
                Status
              </TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects?.map((project) => {
              if (!project || !project.id) return null;

              const IconComponent =
                icons[project.icon as keyof typeof icons] || icons.Layout;
              const isArchived = Boolean(project.archivedAt);
              const statistics = project.statistics ?? {
                totalTasks: 0,
                completionPercentage: 0,
                dueDate: null,
              };

              const getStatusText = () => {
                if (statistics.totalTasks === 0) return "Not started";
                if (statistics.completionPercentage === 100) return "Complete";
                return "In progress";
              };

              const statusVariant = (() => {
                if (statistics.totalTasks === 0) return "secondary";
                if (statistics.completionPercentage === 100) return "default";
                return "outline";
              })();

              return (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{project.name}</span>
                      {isArchived && (
                        <Badge variant="outline" className="text-xs">
                          Archived
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={statistics.completionPercentage}
                        className="w-16 h-2"
                      />
                      <span className="text-sm text-muted-foreground">
                        {statistics.completionPercentage}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm text-muted-foreground">
                      {statistics.dueDate
                        ? new Date(statistics.dueDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )
                        : "No due date"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant={statusVariant}>{getStatusText()}</Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Project actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {!isArchived ? (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await archiveProject({
                                  id: project.id,
                                  workspaceId,
                                });
                                toast.success("Project archived");
                                await Promise.all([
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
                                    : "Failed to archive project",
                                );
                              }
                            }}
                          >
                            <Archive className="text-muted-foreground" />
                            Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await unarchiveProject({
                                  id: project.id,
                                  workspaceId,
                                });
                                toast.success("Project unarchived");
                                await Promise.all([
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
                            <ArchiveRestore className="text-muted-foreground" />
                            Unarchive
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleProjectClick(project.id)}
                        >
                          <LayoutGrid className="text-muted-foreground" />
                          Open
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </WorkspaceLayout>

      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}
