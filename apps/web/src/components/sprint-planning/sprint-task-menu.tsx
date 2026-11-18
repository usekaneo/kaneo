import { useQueryClient } from "@tanstack/react-query";
import { Archive, LinkIcon, Rocket, Trash2, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuGroupLabel,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import type getProjects from "@/fetchers/project/get-projects";
import { useUpdateTaskSprint } from "@/hooks/mutations/sprint/use-update-task-sprint";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import { useUpdateTaskPriority } from "@/hooks/mutations/task/use-update-task-status-priority";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { generateLink } from "@/lib/generate-link";
import { getInitials } from "@/lib/get-initials";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { getTaskPath } from "@/lib/task-link";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";

export const PRIORITY_OPTIONS = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

type SprintTaskMenuArgs = {
  task: Task;
  projectId: string;
  // When the row belongs to a multi selection, the menu edits every selected
  // task; otherwise it edits only the row's own task.
  targets: string[];
  onRequestDelete: (taskIds: string[]) => void;
};

export type SprintTaskMenu = ReturnType<typeof useSprintTaskMenu>;

export function useSprintTaskMenu({
  task,
  projectId,
  targets,
  onRequestDelete,
}: SprintTaskMenuArgs) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const queryClient = useQueryClient();
  const isMulti = targets.length > 1;
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { mutateAsync: updateTaskPriority } = useUpdateTaskPriority();
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const { mutateAsync: updateTaskAssignee } = useUpdateTaskAssignee();
  const { mutateAsync: updateTaskSprint } = useUpdateTaskSprint();
  const operations = useBulkOperations();
  const { data: columnsData = [] } = useGetColumns(projectId);
  const { data: sprints = [] } = useGetSprints(projectId);
  const { data: projectMembers } = useGetProjectMembers({
    workspaceId,
    projectId,
  });
  const { canUpdateTasks, canAssignTasks, canDeleteTasks } =
    useWorkspacePermission();

  const columns =
    project?.columns && project.columns.length > 0
      ? project.columns.map((col) => ({
          slug: col.id,
          name: col.name,
          icon: col.icon,
          isFinal: col.isFinal,
        }))
      : columnsData.map((col) => ({
          slug: col.slug,
          name: col.name,
          icon: col.icon,
          isFinal: col.isFinal,
        }));

  const members = useMemo(
    () =>
      projectMembers?.map((member) => ({
        id: member.id,
        label: member.name || member.email,
        image: member.image ?? "",
      })) ?? [],
    [projectMembers],
  );

  // Closed sprints keep their tasks as history, so nothing moves into them.
  const movableSprints = sprints.filter((sprint) => sprint.status !== "closed");

  const runMulti = async (action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(t("tasks:bulk.updateSuccess", { count: targets.length }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:bulk.updateError"),
      );
    }
  };

  const runSingle = async (action: () => Promise<unknown>) => {
    try {
      await action();
      // The sprint overview reads sprint counts, so a single edit refreshes
      // them too; the bulk operations already invalidate sprints themselves.
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:update.error"),
      );
    }
  };

  const copyLink = () => {
    const path = getTaskPath({
      workspaceId,
      workspace: { id: workspaceId, slug: workspace?.slug ?? null },
      projectId,
      workspaceProjects: queryClient.getQueryData<
        Awaited<ReturnType<typeof getProjects>>
      >(["projects", workspaceId]),
      taskId: task.id,
      taskNumber: task.number,
      title: task.title,
    });
    navigator.clipboard.writeText(generateLink(path));
    toast.success(t("tasks:contextMenu.copyLinkSuccess"), { icon: LinkIcon });
  };

  const setPriority = (priority: string) =>
    isMulti
      ? runMulti(() => operations.bulkPriority({ taskIds: targets, priority }))
      : runSingle(() => updateTaskPriority({ ...task, priority }));

  const setStatus = (status: string) =>
    isMulti
      ? runMulti(() =>
          operations.bulkChangeStatus({ taskIds: targets, status }),
        )
      : runSingle(() => updateTaskStatus({ ...task, status }));

  const setAssignee = (userId: string) =>
    isMulti
      ? runMulti(() => operations.bulkAssign({ taskIds: targets, userId }))
      : runSingle(() => updateTaskAssignee({ ...task, userId }));

  const setSprint = (sprintId: string | null) =>
    isMulti
      ? runMulti(() => operations.bulkSprint({ taskIds: targets, sprintId }))
      : runSingle(() =>
          updateTaskSprint({ taskId: task.id, projectId, sprintId }),
        );

  const archive = () => setStatus("archived");

  return {
    task,
    targets,
    isMulti,
    count: targets.length,
    canEdit: canUpdateTasks(),
    canAssign: canAssignTasks(),
    canDelete: canDeleteTasks(),
    columns,
    members,
    movableSprints,
    copyLink,
    setPriority,
    setStatus,
    setAssignee,
    setSprint,
    archive,
    requestDelete: () => onRequestDelete(targets),
  };
}

function SprintTaskPriorityItems({
  menu,
  CheckboxItem,
}: {
  menu: SprintTaskMenu;
  CheckboxItem: React.ComponentType<{
    checked?: boolean;
    onCheckedChange?: () => void;
    closeOnClick?: boolean;
    className?: string;
    children: React.ReactNode;
  }>;
}) {
  return (
    <>
      {PRIORITY_OPTIONS.map((priority) => (
        <CheckboxItem
          key={priority}
          checked={menu.task.priority === priority}
          onCheckedChange={() => menu.setPriority(priority)}
          closeOnClick
          className="[&_svg]:text-muted-foreground"
        >
          {getPriorityIcon(priority)}
          <span className="capitalize">{getPriorityLabel(priority)}</span>
        </CheckboxItem>
      ))}
    </>
  );
}

function SprintTaskSprintItems({
  menu,
  CheckboxItem,
}: {
  menu: SprintTaskMenu;
  CheckboxItem: React.ComponentType<{
    checked?: boolean;
    onCheckedChange?: () => void;
    closeOnClick?: boolean;
    className?: string;
    children: React.ReactNode;
  }>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <CheckboxItem
        checked={!menu.task.sprintId}
        onCheckedChange={() => menu.setSprint(null)}
        closeOnClick
      >
        {t("tasks:sprints.backlog")}
      </CheckboxItem>
      {menu.movableSprints.map((sprint) => (
        <CheckboxItem
          key={sprint.id}
          checked={menu.task.sprintId === sprint.id}
          onCheckedChange={() => menu.setSprint(sprint.id)}
          closeOnClick
        >
          <span className="max-w-40 truncate">{sprint.name}</span>
        </CheckboxItem>
      ))}
    </>
  );
}

function SprintTaskAssigneeItems({
  menu,
  CheckboxItem,
}: {
  menu: SprintTaskMenu;
  CheckboxItem: React.ComponentType<{
    checked?: boolean;
    onCheckedChange?: () => void;
    closeOnClick?: boolean;
    className?: string;
    children: React.ReactNode;
  }>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <CheckboxItem
        checked={!menu.task.userId}
        onCheckedChange={() => menu.setAssignee("")}
        closeOnClick
      >
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted"
          title={t("tasks:assignee.unassigned")}
        >
          <span className="text-[10px] font-medium text-muted-foreground">
            ?
          </span>
        </div>
        {t("tasks:assignee.unassigned")}
      </CheckboxItem>
      {menu.members.map((member) => (
        <CheckboxItem
          key={member.id}
          checked={menu.task.userId === member.id}
          onCheckedChange={() => menu.setAssignee(member.id)}
          closeOnClick
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={member.image} alt="" />
            <AvatarFallback className="border border-border/30 text-xs font-medium">
              {getInitials(member.label)}
            </AvatarFallback>
          </Avatar>
          {member.label}
        </CheckboxItem>
      ))}
    </>
  );
}

// Items of the three-dot menu next to every sprint row.
export function SprintTaskMenuItems({ menu }: { menu: SprintTaskMenu }) {
  const { t } = useTranslation();
  return (
    <>
      {menu.isMulti && (
        <MenuGroupLabel>
          {t("tasks:bulk.selectedCount", { count: menu.count })}
        </MenuGroupLabel>
      )}
      {!menu.isMulti && (
        <MenuItem onClick={menu.copyLink}>
          <LinkIcon className="size-3.5 text-muted-foreground" />
          {t("tasks:contextMenu.copyLink")}
        </MenuItem>
      )}
      {(menu.canEdit || menu.canAssign) && <MenuSeparator />}
      {menu.canEdit && (
        <MenuSub>
          <MenuSubTrigger>
            <PriorityGlyph priority="high" />
            <span>{t("tasks:priority.label")}</span>
          </MenuSubTrigger>
          <MenuSubPopup className="w-48">
            <SprintTaskPriorityItems
              menu={menu}
              CheckboxItem={MenuCheckboxItem}
            />
          </MenuSubPopup>
        </MenuSub>
      )}
      {menu.canEdit && (
        <MenuSub>
          <MenuSubTrigger>
            <span className="size-3.5 text-muted-foreground">
              {getColumnIcon(menu.task.status, false, null)}
            </span>
            <span>{t("tasks:status.label")}</span>
          </MenuSubTrigger>
          <MenuSubPopup className="w-48">
            {menu.columns.map((col) => (
              <MenuCheckboxItem
                key={col.slug}
                checked={menu.task.status === col.slug}
                onCheckedChange={() => menu.setStatus(col.slug)}
                closeOnClick
                className="[&_svg]:text-muted-foreground"
              >
                {getColumnIcon(col.slug, col.isFinal, col.icon)}
                <span>{col.name}</span>
              </MenuCheckboxItem>
            ))}
          </MenuSubPopup>
        </MenuSub>
      )}
      {menu.canEdit && (
        <MenuSub>
          <MenuSubTrigger>
            <Rocket className="size-3.5 text-muted-foreground" />
            <span>{t("tasks:bulk.moveToSprint")}</span>
          </MenuSubTrigger>
          <MenuSubPopup className="w-48">
            <SprintTaskSprintItems
              menu={menu}
              CheckboxItem={MenuCheckboxItem}
            />
          </MenuSubPopup>
        </MenuSub>
      )}
      {menu.canAssign && (
        <MenuSub>
          <MenuSubTrigger>
            <UserRound className="size-3.5 text-muted-foreground" />
            <span>{t("tasks:assignee.label")}</span>
          </MenuSubTrigger>
          <MenuSubPopup className="w-48">
            <SprintTaskAssigneeItems
              menu={menu}
              CheckboxItem={MenuCheckboxItem}
            />
          </MenuSubPopup>
        </MenuSub>
      )}
      {(menu.canEdit || menu.canDelete) && <MenuSeparator />}
      {menu.canEdit && (
        <MenuItem onClick={menu.archive}>
          <Archive className="size-3.5 text-muted-foreground" />
          {t("tasks:actions.archive")}
        </MenuItem>
      )}
      {menu.canDelete && (
        <MenuItem variant="destructive" onClick={menu.requestDelete}>
          <Trash2 className="size-3.5" />
          {t("tasks:actions.delete")}
        </MenuItem>
      )}
    </>
  );
}

// Items of the right-click menu on a sprint row: the same actions as the
// three-dot menu, rendered with the context menu primitives.
export function SprintTaskContextMenuItems({ menu }: { menu: SprintTaskMenu }) {
  const { t } = useTranslation();
  return (
    <>
      {menu.isMulti && (
        <ContextMenuLabel>
          {t("tasks:bulk.selectedCount", { count: menu.count })}
        </ContextMenuLabel>
      )}
      {!menu.isMulti && (
        <ContextMenuItem onClick={menu.copyLink}>
          <LinkIcon className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:contextMenu.copyLink")}</span>
        </ContextMenuItem>
      )}
      {(menu.canEdit || menu.canAssign) && <ContextMenuSeparator />}
      {menu.canEdit && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <PriorityGlyph priority="high" />
            <span>{t("tasks:priority.label")}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <SprintTaskPriorityItems
              menu={menu}
              CheckboxItem={ContextMenuCheckboxItem}
            />
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {menu.canEdit && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <span className="size-3.5 text-muted-foreground">
              {getColumnIcon(menu.task.status, false, null)}
            </span>
            <span>{t("tasks:status.label")}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {menu.columns.map((col) => (
              <ContextMenuCheckboxItem
                key={col.slug}
                checked={menu.task.status === col.slug}
                onCheckedChange={() => menu.setStatus(col.slug)}
                closeOnClick
                className="[&_svg]:text-muted-foreground"
              >
                {getColumnIcon(col.slug, col.isFinal, col.icon)}
                <span>{col.name}</span>
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {menu.canEdit && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Rocket className="size-3.5 text-muted-foreground" />
            <span>{t("tasks:bulk.moveToSprint")}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <SprintTaskSprintItems
              menu={menu}
              CheckboxItem={ContextMenuCheckboxItem}
            />
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {menu.canAssign && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <UserRound className="size-3.5 text-muted-foreground" />
            <span>{t("tasks:assignee.label")}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <SprintTaskAssigneeItems
              menu={menu}
              CheckboxItem={ContextMenuCheckboxItem}
            />
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {(menu.canEdit || menu.canDelete) && <ContextMenuSeparator />}
      {menu.canEdit && (
        <ContextMenuItem onClick={menu.archive}>
          <Archive className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:actions.archive")}</span>
        </ContextMenuItem>
      )}
      {menu.canDelete && (
        <ContextMenuItem variant="destructive" onClick={menu.requestDelete}>
          <Trash2 className="size-3.5" />
          <span>{t("tasks:actions.delete")}</span>
        </ContextMenuItem>
      )}
    </>
  );
}
