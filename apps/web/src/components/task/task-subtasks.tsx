import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, ListPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { TaskChecklist } from "@/fetchers/checklist";
import { useChecklistActions, useChecklists } from "@/hooks/checklist";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import type Task from "@/types/task";
import ChecklistBlock, { listDragId, SortableItem } from "./checklist-block";
import SubtaskRow from "./subtask-row";

type TaskSubtasksProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  parentStatus: string;
};

/** checklistId → relation ids, in order. */
type ItemOrder = Record<string, string[]>;

/**
 * The task's checklists. Each item is a real subtask (a task linked to this
 * one), so it keeps its own status, assignee and page; checklists only name
 * and order them.
 */
export default function TaskSubtasks({
  taskId,
  projectId,
  workspaceId,
  parentStatus,
}: TaskSubtasksProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [checklistName, setChecklistName] = useState("");
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteChecklist, setDeleteChecklist] = useState<{
    id: string;
    name: string;
    items: number;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  // While dragging (and until the save lands) the order shown is local.
  const [draftItems, setDraftItems] = useState<ItemOrder | null>(null);
  const [draftLists, setDraftLists] = useState<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: checklists = [] } = useChecklists(taskId);
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const createTask = useCreateTask();
  const createRelation = useCreateTaskRelation();
  const checklistActions = useChecklistActions(taskId);
  const { mutateAsync: deleteTask } = useDeleteTask();
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const { data: columns = [], isLoading: isLoadingColumns } =
    useGetColumns(projectId);
  const { canCreateTasks, canUpdateTasks, canDeleteTasks } =
    useWorkspacePermission();
  const canEdit = Boolean(canUpdateTasks());
  const canCreate = Boolean(canCreateTasks());

  // Map the completion checkbox to the project's actual column slugs (the API
  // validates status against columns). A subtask counts as completed when its
  // status is a final column.
  const doneSlug = columns.find((c) => c.isFinal)?.slug ?? "done";
  const todoSlug = columns.find((c) => !c.isFinal)?.slug;
  const canCreateSubtask =
    parentStatus === "planned" || (!isLoadingColumns && Boolean(todoSlug));
  const isCompleted = useCallback(
    (status: string) =>
      columns.length > 0
        ? (columns.find((c) => c.slug === status)?.isFinal ?? false)
        : status === "done",
    [columns],
  );

  const subtasks = useMemo(
    () =>
      relations
        .filter(
          (rel) =>
            rel.relationType === "subtask" && rel.sourceTaskId === taskId,
        )
        .map((rel) => ({ relation: rel, task: rel.targetTask }))
        .filter(
          (
            item,
          ): item is typeof item & { task: NonNullable<typeof item.task> } =>
            item.task !== null,
        ),
    [relations, taskId],
  );
  const byRelation = useMemo(
    () => new Map(subtasks.map((s) => [s.relation.id, s])),
    [subtasks],
  );

  const serverLists = useMemo(() => checklists.map((c) => c.id), [checklists]);
  const serverItems = useMemo(() => {
    const order: ItemOrder = Object.fromEntries(
      checklists.map((c) => [c.id, [] as string[]]),
    );
    const firstId = checklists[0]?.id;
    for (const s of [...subtasks].sort(
      (a, b) => a.relation.position - b.relation.position,
    )) {
      // Not placed yet (the list refetches right after the API places it).
      const home =
        s.relation.checklistId && order[s.relation.checklistId]
          ? s.relation.checklistId
          : firstId;
      if (home) order[home]?.push(s.relation.id);
    }
    return order;
  }, [checklists, subtasks]);

  const listOrder = draftLists ?? serverLists;
  const itemOrder = draftItems ?? serverItems;
  const checklistById = useMemo(
    () => new Map(checklists.map((c) => [c.id, c])),
    [checklists],
  );
  const orderedLists = listOrder
    .map((id) => checklistById.get(id))
    .filter((c): c is TaskChecklist => Boolean(c));

  // Keyboard navigation and selection run over every item, list by list.
  const flat = orderedLists.flatMap((c) =>
    (itemOrder[c.id] ?? [])
      .map((id) => byRelation.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s)),
  );
  const hasSelection = selectedIds.size > 0;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setFocusedIndex(-1);
  }, []);

  const buildTaskObject = (subtask: (typeof subtasks)[number]): Task => ({
    id: subtask.task.id,
    title: subtask.task.title,
    number: subtask.task.number,
    description: null,
    status: subtask.task.status,
    priority: subtask.task.priority,
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "",
    userId: subtask.task.userId,
    assigneeId: subtask.task.userId,
    assigneeName: subtask.task.assigneeName,
    projectId: subtask.task.projectId,
  });

  const getTargetTasks = (currentTask: Task): Task[] => {
    if (hasSelection && selectedIds.has(currentTask.id)) {
      return subtasks
        .filter((s) => selectedIds.has(s.task.id))
        .map(buildTaskObject);
    }
    return [currentTask];
  };

  const handleToggleComplete = async (taskObj: Task) => {
    try {
      await updateTaskStatus({
        ...taskObj,
        status: isCompleted(taskObj.status) ? (todoSlug ?? "to-do") : doneSlug,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.status.updateError"),
      );
    }
  };

  const getAssignee = (userId: string | null) => {
    if (!userId || !workspaceUsers?.members) return null;
    return (
      workspaceUsers.members.find((member) => member.userId === userId) ?? null
    );
  };

  const getSelectionRadius = (ids: string[], index: number) => {
    const at = (i: number) => byRelation.get(ids[i] ?? "")?.task.id ?? "";
    if (!selectedIds.has(at(index))) return "rounded-md";
    const prevSelected = index > 0 && selectedIds.has(at(index - 1));
    const nextSelected =
      index < ids.length - 1 && selectedIds.has(at(index + 1));
    if (prevSelected && nextSelected) return "rounded-none";
    if (prevSelected) return "rounded-t-none rounded-b-md";
    if (nextSelected) return "rounded-t-md rounded-b-none";
    return "rounded-md";
  };

  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    const count = flat.length;
    if (!container || count === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], .ProseMirror",
        )
      )
        return;

      if (!container.contains(document.activeElement) && focusedIndex === -1)
        return;

      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          setFocusedIndex((prev) => (prev < count - 1 ? prev + 1 : prev));
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        }
        case " ": {
          const item = flat[focusedIndex];
          if (item) {
            e.preventDefault();
            toggleSelection(item.task.id);
          }
          break;
        }
        case "Enter": {
          const item = flat[focusedIndex];
          if (item) {
            e.preventDefault();
            navigate({
              to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
              params: { workspaceId, projectId, taskId: item.task.id },
            });
          }
          break;
        }
        case "Escape": {
          if (hasSelection) {
            e.preventDefault();
            clearSelection();
          } else if (focusedIndex >= 0) {
            e.preventDefault();
            setFocusedIndex(-1);
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    focusedIndex,
    flat,
    hasSelection,
    clearSelection,
    navigate,
    workspaceId,
    projectId,
    toggleSelection,
  ]);

  const addItem = async (checklistId: string, title: string) => {
    if (!canCreate || !canEdit) return false;
    const initialStatus = parentStatus === "planned" ? "planned" : todoSlug;
    if (!initialStatus) return false;
    try {
      const newTask = await createTask.mutateAsync({
        title,
        description: "",
        projectId,
        status: initialStatus,
        priority: "no-priority",
      });
      await createRelation.mutateAsync({
        sourceTaskId: taskId,
        targetTaskId: newTask.id,
        relationType: "subtask",
        checklistId,
      });
      return true;
    } catch {
      toast.error(t("tasks:subtasks.createError"));
      return false;
    }
  };

  const addChecklist = () => {
    checklistActions.create.mutate(checklistName.trim() || undefined, {
      onSuccess: () => {
        setChecklistName("");
        setAddingChecklist(false);
      },
      onError: (error) =>
        toast.error(error.message || t("tasks:subtasks.error")),
    });
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;
    try {
      await deleteTask(deleteTaskId);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-relations", taskId] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTaskId);
        return next;
      });
      toast.success(t("tasks:subtasks.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:subtasks.deleteError"),
      );
    } finally {
      setDeleteTaskId(null);
    }
  };

  // ---------------------------------------------------------------- drag

  const sensors = useSensors(
    // A few pixels of movement first, so clicks on the row still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const containerOf = (id: string, order: ItemOrder) => {
    if (id.startsWith("drop:")) return id.slice(5);
    if (id.startsWith("list:")) return id.slice(5);
    return Object.keys(order).find((key) => order[key]?.includes(id));
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    if (id.startsWith("list:")) setDraftLists(serverLists);
    else setDraftItems(structuredClone(serverItems));
  };

  // Moving over another checklist carries the item across while dragging.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const activeId = String(active.id);
    if (!over || activeId.startsWith("list:")) return;
    setDraftItems((current) => {
      if (!current) return current;
      const from = containerOf(activeId, current);
      const to = containerOf(String(over.id), current);
      if (!from || !to || from === to) return current;
      const target = current[to] ?? [];
      const overIndex = target.indexOf(String(over.id));
      const at = overIndex >= 0 ? overIndex : target.length;
      return {
        ...current,
        [from]: (current[from] ?? []).filter((id) => id !== activeId),
        [to]: [...target.slice(0, at), activeId, ...target.slice(at)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const activeId = String(active.id);

    if (activeId.startsWith("list:")) {
      const lists = draftLists ?? serverLists;
      const overList = over ? containerOf(String(over.id), itemOrder) : null;
      const fromIndex = lists.indexOf(activeId.slice(5));
      const toIndex = overList ? lists.indexOf(overList) : -1;
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        setDraftLists(null);
        return;
      }
      const next = arrayMove(lists, fromIndex, toIndex);
      setDraftLists(next);
      checklistActions.reorder.mutate(next, {
        onSettled: () => setDraftLists(null),
      });
      return;
    }

    const current = draftItems;
    const to = current ? containerOf(activeId, current) : undefined;
    if (!current || !over || !to) {
      setDraftItems(null);
      return;
    }
    const items = current[to] ?? [];
    const overIndex = items.indexOf(String(over.id));
    const next =
      overIndex >= 0
        ? arrayMove(items, items.indexOf(activeId), overIndex)
        : items;
    const unchanged =
      JSON.stringify(serverItems[to]) === JSON.stringify(next) &&
      serverItems[to]?.includes(activeId);
    if (unchanged) {
      setDraftItems(null);
      return;
    }
    setDraftItems({ ...current, [to]: next });
    checklistActions.setItems.mutate(
      { id: to, relationIds: next },
      {
        onError: (error) =>
          toast.error(error.message || t("tasks:subtasks.error")),
        onSettled: () => setDraftItems(null),
      },
    );
  };

  const onDragCancel = () => {
    setDraftItems(null);
    setDraftLists(null);
  };

  let flatIndex = -1;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                <span>{t("tasks:subtasks.title")}</span>
              </button>
            </CollapsibleTrigger>
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1 text-muted-foreground"
              onClick={() => {
                setIsOpen(true);
                setAddingChecklist(true);
              }}
            >
              <ListPlus className="size-3.5" />
              {t("tasks:subtasks.addChecklist")}
            </Button>
          )}
        </div>

        <CollapsibleContent>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard nav managed via document listener */}
          <div
            ref={containerRef}
            className="mt-1 flex flex-col gap-3"
            onMouseDown={() => {
              if (focusedIndex === -1 && !hasSelection) {
                setFocusedIndex(0);
              }
            }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              <SortableContext
                items={orderedLists.map((c) => listDragId(c.id))}
                strategy={verticalListSortingStrategy}
              >
                {orderedLists.map((checklist) => {
                  const ids = itemOrder[checklist.id] ?? [];
                  const items = ids
                    .map((id) => byRelation.get(id))
                    .filter((s): s is NonNullable<typeof s> => Boolean(s));
                  return (
                    <ChecklistBlock
                      key={checklist.id}
                      checklist={checklist}
                      itemIds={ids}
                      completed={
                        items.filter((s) => isCompleted(s.task.status)).length
                      }
                      canEdit={canEdit}
                      canAddItems={canEdit && canCreate && canCreateSubtask}
                      onRename={(title) =>
                        checklistActions.rename.mutate(
                          { id: checklist.id, title },
                          {
                            onError: (error) =>
                              toast.error(
                                error.message || t("tasks:subtasks.error"),
                              ),
                          },
                        )
                      }
                      onDelete={() =>
                        setDeleteChecklist({
                          id: checklist.id,
                          name:
                            checklist.title ?? t("tasks:subtasks.defaultName"),
                          items: items.length,
                        })
                      }
                      onAddItem={(title) => addItem(checklist.id, title)}
                    >
                      <AnimatePresence initial={false}>
                        {items.map((subtask, index) => {
                          flatIndex += 1;
                          const rowIndex = flatIndex;
                          const taskObj = buildTaskObject(subtask);
                          return (
                            <SortableItem
                              key={subtask.relation.id}
                              id={subtask.relation.id}
                              disabled={!canEdit}
                            >
                              {(handle) => (
                                <SubtaskRow
                                  task={taskObj}
                                  tasks={getTargetTasks(taskObj)}
                                  projectId={projectId}
                                  workspaceId={workspace?.id ?? workspaceId}
                                  isSelected={selectedIds.has(subtask.task.id)}
                                  isFocused={focusedIndex === rowIndex}
                                  isCompleted={isCompleted(subtask.task.status)}
                                  canEdit={canEdit}
                                  selectionRadius={getSelectionRadius(
                                    ids,
                                    index,
                                  )}
                                  assignee={getAssignee(subtask.task.userId)}
                                  dragHandle={handle}
                                  onToggleComplete={() =>
                                    handleToggleComplete(taskObj)
                                  }
                                  onNavigate={() =>
                                    navigate({
                                      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                                      params: {
                                        workspaceId,
                                        projectId,
                                        taskId: subtask.task.id,
                                      },
                                    })
                                  }
                                  onDeleteClick={() =>
                                    setDeleteTaskId(subtask.task.id)
                                  }
                                />
                              )}
                            </SortableItem>
                          );
                        })}
                      </AnimatePresence>
                    </ChecklistBlock>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>

          {addingChecklist && canEdit && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                size="sm"
                autoFocus
                maxLength={120}
                placeholder={t("tasks:subtasks.checklistNamePlaceholder")}
                aria-label={t("tasks:subtasks.checklistName")}
                value={checklistName}
                onChange={(e) => setChecklistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addChecklist();
                  if (e.key === "Escape") {
                    setAddingChecklist(false);
                    setChecklistName("");
                  }
                }}
              />
              <Button
                size="xs"
                onClick={addChecklist}
                disabled={checklistActions.create.isPending}
              >
                {t("tasks:subtasks.addAction")}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setAddingChecklist(false);
                  setChecklistName("");
                }}
              >
                {t("common:actions.cancel")}
              </Button>
            </div>
          )}

          {!addingChecklist && orderedLists.length === 0 && (
            <div className="flex items-center gap-2 px-2 py-1">
              <p className="text-xs text-muted-foreground">
                {t("tasks:subtasks.empty")}
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog
        open={!!deleteTaskId}
        onOpenChange={(open) => !open && setDeleteTaskId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("tasks:subtasks.deleteDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:subtasks.deleteDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteTask}
                />
              }
            >
              {t("tasks:subtasks.deleteAction")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteChecklist}
        onOpenChange={(open) => !open && setDeleteChecklist(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("tasks:subtasks.deleteChecklistTitle", {
                name: deleteChecklist?.name ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteChecklist?.items
                ? t("tasks:subtasks.deleteChecklistWithItems", {
                    count: deleteChecklist.items,
                  })
                : t("tasks:subtasks.deleteChecklistEmpty")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    Boolean(deleteChecklist?.items) && !canDeleteTasks()
                  }
                  onClick={() => {
                    if (!deleteChecklist) return;
                    checklistActions.remove.mutate(deleteChecklist.id, {
                      onSuccess: () =>
                        toast.success(t("tasks:subtasks.checklistDeleted")),
                      onError: (error) =>
                        toast.error(error.message || t("tasks:subtasks.error")),
                    });
                  }}
                />
              }
            >
              {t("tasks:subtasks.deleteChecklist")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
