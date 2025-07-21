import WorkspaceLayout from "@/components/common/workspace-layout";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import icons from "@/constants/project-icons";
import { shortcuts } from "@/constants/shortcuts";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/workspace/$workspaceId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { data: projects, isLoading } = useGetProjects({
    workspaceId,
  });

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

  if (isLoading) {
    return (
      <WorkspaceLayout
        title="Projects"
        headerActions={
          <Button
            variant="outline"
            size="xs"
            onClick={handleCreateProject}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            Create project
          </Button>
        }
      >
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WorkspaceLayout>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <>
        <WorkspaceLayout
          title="Projects"
          headerActions={
            <Button
              variant="outline"
              size="xs"
              onClick={handleCreateProject}
              className="gap-1"
            >
              <Plus className="w-3 h-3" />
              Create project
            </Button>
          }
        >
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-xl bg-muted flex items-center justify-center">
                <LayoutGrid className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No projects yet</h3>
                <p className="text-muted-foreground">
                  Get started by creating your first project.
                </p>
              </div>
              <Button onClick={handleCreateProject} className="gap-2">
                <Plus className="w-4 h-4" />
                Create project
              </Button>
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
      <WorkspaceLayout
        title="Projects"
        headerActions={
          <Button
            variant="outline"
            size="xs"
            onClick={handleCreateProject}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            Create project
          </Button>
        }
      >
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects?.map((project) => {
              if (!project || !project.id || !project.statistics) return null;

              const IconComponent =
                icons[project.icon as keyof typeof icons] || icons.Layout;

              const getStatusText = () => {
                if (project.statistics.totalTasks === 0) return "Not started";
                if (project.statistics.completionPercentage === 100)
                  return "Complete";
                return "In progress";
              };

              const getStatusVariant = () => {
                if (project.statistics.totalTasks === 0) return "secondary";
                if (project.statistics.completionPercentage === 100)
                  return "default";
                return "outline";
              };

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
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={project.statistics.completionPercentage}
                        className="w-16 h-2"
                      />
                      <span className="text-sm text-muted-foreground">
                        {project.statistics.completionPercentage}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm text-muted-foreground">
                      {project.statistics.dueDate
                        ? new Date(
                            project.statistics.dueDate,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No due date"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant={getStatusVariant()}>
                      {getStatusText()}
                    </Badge>
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
