import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Layers, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import CircularProgress from "@/components/ui/circular-progress";
import { Input } from "@/components/ui/input";
import { shortcuts } from "@/constants/shortcuts";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetProject from "@/hooks/queries/project/use-get-project";
import {
  type ProjectEpic,
  useGetProjectEpics,
} from "@/hooks/queries/task/use-get-project-epics";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getInitials } from "@/lib/get-initials";
import { getStatusLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";

type EpicsSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/epics",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): EpicsSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

type WorkspaceMembers = NonNullable<
  ReturnType<typeof useGetActiveWorkspaceUsers>["data"]
>["members"];

function EpicRow({
  epic,
  columns,
  members,
  onOpen,
}: {
  epic: ProjectEpic;
  columns: ReturnType<typeof useGetColumns>["data"];
  members: WorkspaceMembers | undefined;
  onOpen: (taskId: string) => void;
}) {
  const { data: relations = [] } = useGetTaskRelations(epic.id);

  const children = relations.filter(
    (rel) => rel.relationType === "epic" && rel.sourceTaskId === epic.id,
  );

  const isFinal = (status: string) =>
    columns && columns.length > 0
      ? (columns.find((c) => c.slug === status)?.isFinal ?? false)
      : status === "done";

  const completedCount = children.filter(
    (rel) => rel.targetTask && isFinal(rel.targetTask.status),
  ).length;
  const totalCount = children.length;

  const assignee = members?.find((member) => member.userId === epic.userId);

  return (
    <button
      type="button"
      onClick={() => onOpen(epic.id)}
      className="flex w-full items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
    >
      <Layers className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-16 shrink-0 truncate text-xs font-mono text-muted-foreground">
        {epic.number}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {epic.title}
      </span>
      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
        {getStatusLabel(epic.status)}
      </span>
      <span className="shrink-0">
        {getPriorityIcon(epic.priority ?? "no-priority")}
      </span>
      {totalCount > 0 && (
        <span className="flex shrink-0 items-center gap-1.5">
          <CircularProgress completed={completedCount} total={totalCount} />
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        </span>
      )}
      <Avatar className="size-6 shrink-0">
        <AvatarImage
          src={assignee?.user?.image ?? ""}
          alt={assignee?.user?.name || ""}
        />
        <AvatarFallback className="text-[10px] font-medium border border-border/30">
          {epic.userId ? getInitials(assignee?.user?.name) : "?"}
        </AvatarFallback>
      </Avatar>
    </button>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: epics = [], isLoading } = useGetProjectEpics(projectId);
  const { data: columns = [] } = useGetColumns(projectId);
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const createTask = useCreateTask();
  const { canCreateTasks } = useWorkspacePermission();
  const canCreate = canCreateTasks();

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const todoSlug = columns.find((c) => !c.isFinal)?.slug ?? "to-do";

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.view.prefix]: {
        [shortcuts.view.board]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.list]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.calendar]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.gantt]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.backlog]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.epics]: () => {},
      },
    },
  });

  const handleOpenEpic = (openTaskId: string) => {
    navigate({ to: ".", search: { taskId: openTaskId }, replace: true });
  };

  const handleCloseTaskSheet = () => {
    navigate({ to: ".", search: {}, replace: true });
  };

  const handleAddEpic = async () => {
    if (!canCreate || !newTitle.trim()) return;

    try {
      await createTask.mutateAsync({
        title: newTitle.trim(),
        description: "",
        projectId,
        status: todoSlug,
        priority: "no-priority",
        type: "epic",
      });

      setNewTitle("");
      setIsAdding(false);
    } catch {
      toast.error(t("tasks:epics.createError"));
    }
  };

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="epics"
    >
      <PageTitle title={t("tasks:epics.pageTitle", { name: project?.name })} />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5">
          <h1 className="text-sm font-semibold text-foreground">
            {t("tasks:epics.title")}
          </h1>
          {canCreate && (
            <Button
              variant="outline"
              size="xs"
              className="gap-1.5"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="size-3.5" />
              {t("tasks:epics.newEpic")}
            </Button>
          )}
        </div>

        {isAdding && (
          <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5">
            <Input
              size="sm"
              autoFocus
              placeholder={t("tasks:epics.inputPlaceholder")}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddEpic();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewTitle("");
                }
              }}
            />
            <Button
              size="xs"
              onClick={handleAddEpic}
              disabled={!newTitle.trim() || createTask.isPending}
            >
              {t("tasks:epics.children.addAction")}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setIsAdding(false);
                setNewTitle("");
              }}
            >
              {t("common:actions.cancel")}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {!isLoading && epics.length === 0 && (
            <div className="flex h-full items-center justify-center px-6">
              <div className="max-w-sm text-center">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("tasks:epics.empty")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("tasks:epics.emptySubtitle")}
                </p>
              </div>
            </div>
          )}

          {epics.map((epic) => (
            <EpicRow
              key={epic.id}
              epic={epic}
              columns={columns}
              members={workspaceUsers?.members}
              onOpen={handleOpenEpic}
            />
          ))}
        </div>

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />
      </div>
    </ProjectLayout>
  );
}
