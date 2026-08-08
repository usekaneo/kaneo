import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GripVertical, LayoutGrid, Plus } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import useReorderProjects from "@/hooks/mutations/project/use-reorder-projects";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/",
)({
  component: RouteComponent,
});

function SortableProjectRow({
  id,
  canReorder,
  onClick,
  children,
}: {
  id: string;
  canReorder: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="group/row cursor-pointer"
      onClick={onClick}
    >
      <TableCell className="w-8 py-3 pe-0">
        {canReorder && (
          // The row itself navigates on click, so only the handle activates a
          // drag.
          <button
            type="button"
            className="flex cursor-grab items-center text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 hover:text-foreground"
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
            <span className="sr-only">
              {t("workspace:projects.reorderHandle")}
            </span>
          </button>
        )}
      </TableCell>
      {children}
    </TableRow>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { data: projects, isLoading } = useGetProjects({
    workspaceId,
  });
  const { mutate: reorderProjects } = useReorderProjects();
  const { canCreateProjects, canManageProjects } = useWorkspacePermission();
  const canCreate = canCreateProjects();
  const canReorder = canManageProjects();

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !projects) return;

    const oldIndex = projects.findIndex((project) => project.id === active.id);
    const newIndex = projects.findIndex((project) => project.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(projects, oldIndex, newIndex);

    reorderProjects(
      {
        workspaceId,
        projects: reordered.map((project, index) => ({
          id: project.id,
          position: index,
        })),
      },
      {
        onError: () => {
          toast.error(t("workspace:projects.reorderError"));
        },
      },
    );
  };

  const handleCreateProject = () => {
    if (!canCreate) return;
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
      <>
        <PageTitle title={t("workspace:projects.pageTitle")} />
        <WorkspaceLayout
          title={t("workspace:projects.pageTitle")}
          headerActions={
            canCreate ? (
              <Button
                variant="outline"
                size="xs"
                onClick={handleCreateProject}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                {t("workspace:projects.createProject")}
              </Button>
            ) : null
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.title")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.progress")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.targetDate")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.status")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell className="w-8 py-3 pe-0" />
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
      </>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <>
        <PageTitle title={t("workspace:projects.pageTitle")} />
        <WorkspaceLayout
          title={t("workspace:projects.pageTitle")}
          headerActions={
            canCreate ? (
              <Button
                variant="outline"
                size="xs"
                onClick={handleCreateProject}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                {t("workspace:projects.createProject")}
              </Button>
            ) : null
          }
        >
          <Empty className="min-h-[60vh]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>{t("workspace:projects.emptyTitle")}</EmptyTitle>
              <EmptyDescription>
                {canCreate
                  ? t("workspace:projects.emptyDescription")
                  : t("workspace:projects.emptyDescriptionReadOnly")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {canCreate && (
                <Button onClick={handleCreateProject}>
                  <Plus />
                  {t("workspace:projects.createProject")}
                </Button>
              )}
            </EmptyContent>
          </Empty>
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
      <PageTitle title={t("workspace:projects.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:projects.pageTitle")}
        headerActions={
          canCreate ? (
            <Button
              variant="outline"
              size="xs"
              onClick={handleCreateProject}
              className="gap-1"
            >
              <Plus className="w-3 h-3" />
              {t("workspace:projects.createProject")}
            </Button>
          ) : null
        }
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader className="p-4">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.title")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.progress")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.dueDate")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("workspace:projects.status")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={projects?.map((project) => project.id) ?? []}
                strategy={verticalListSortingStrategy}
              >
                {projects?.map((project) => {
                  if (!project || !project.id || !project.statistics)
                    return null;

                  const IconComponent =
                    icons[project.icon as keyof typeof icons] || icons.Layout;

                  const getStatusText = () => {
                    if (project.statistics.totalTasks === 0)
                      return t("workspace:projects.projectStatus.notStarted");
                    if (project.statistics.completionPercentage === 100)
                      return t("workspace:projects.projectStatus.complete");
                    return t("workspace:projects.projectStatus.inProgress");
                  };

                  const getStatusVariant = () => {
                    if (project.statistics.totalTasks === 0) return "secondary";
                    if (project.statistics.completionPercentage === 100)
                      return "default";
                    return "outline";
                  };

                  return (
                    <SortableProjectRow
                      key={project.id}
                      id={project.id}
                      canReorder={canReorder}
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
                            ? formatDateMedium(project.statistics.dueDate)
                            : t("workspace:projects.noDueDate")}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={getStatusVariant()}>
                          {getStatusText()}
                        </Badge>
                      </TableCell>
                    </SortableProjectRow>
                  );
                })}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </WorkspaceLayout>

      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}
