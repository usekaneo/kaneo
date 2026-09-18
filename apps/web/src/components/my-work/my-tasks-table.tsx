import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import {
  differenceInCalendarDays,
  isBefore,
  isToday,
  startOfToday,
} from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  GripVertical,
  Paperclip,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CircularProgress from "@/components/ui/circular-progress";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PersonTask } from "@/fetchers/people/get-person-tasks";
import useInlineTaskUpdate from "@/hooks/mutations/task/use-inline-task-update";
import useSetTaskOrder from "@/hooks/mutations/task/use-set-task-order";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { getColumnIcon, getStatusPillClass } from "@/lib/column";
import { formatDateShort } from "@/lib/format";
import { formatHours } from "@/lib/format-duration";
import { getInitials } from "@/lib/get-initials";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import resolveAvatarSrc from "@/lib/resolve-avatar-src";
import { toast } from "@/lib/toast";

const PRIORITIES = ["urgent", "high", "medium", "low", "no-priority"] as const;
const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  "no-priority": 4,
};

const FILTERS = [
  "open",
  "today",
  "overdue",
  "week",
  "urgent",
  "fromOthers",
  "done",
] as const;
type Filter = (typeof FILTERS)[number];

type SortKey = "manual" | "due" | "priority" | "title" | "project" | "created";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const DEFAULT_SORT: Sort = { key: "due", dir: "asc" };
const MANUAL_SORT: Sort = { key: "manual", dir: "asc" };
const SORT_STORAGE_KEY = "kaneo:my-work:sort";

// The chosen sort is a per-browser convenience; storage may be unavailable.
function loadSort(): Sort {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? "null");
    if (saved && typeof saved.key === "string" && typeof saved.dir === "string")
      return saved as Sort;
  } catch {}
  return DEFAULT_SORT;
}

function saveSort(sort: Sort) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch {}
}

const ALL_PROJECTS = "__all__";

function dueState(task: PersonTask) {
  if (!task.dueDate || task.done) return "none" as const;
  const due = new Date(task.dueDate);
  if (isToday(due)) return "today" as const;
  if (isBefore(due, startOfToday())) return "overdue" as const;
  return "upcoming" as const;
}

function matches(task: PersonTask, filter: Filter, userId: string) {
  switch (filter) {
    case "open":
      return !task.done;
    case "today":
      return dueState(task) === "today";
    case "overdue":
      return dueState(task) === "overdue";
    case "week":
      return (
        !task.done &&
        task.dueDate !== null &&
        differenceInCalendarDays(new Date(task.dueDate), new Date()) <= 7
      );
    case "urgent":
      return (
        !task.done && (task.priority === "urgent" || task.priority === "high")
      );
    case "fromOthers":
      return (
        !task.done && task.assignedById !== null && task.assignedById !== userId
      );
    case "done":
      return task.done;
  }
}

function compare(a: PersonTask, b: PersonTask, sort: Sort) {
  const dir = sort.dir === "asc" ? 1 : -1;
  switch (sort.key) {
    case "manual": {
      // Tasks not arranged yet (new ones) sit on top, newest first.
      if (a.myPosition === null && b.myPosition === null)
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      if (a.myPosition === null) return -1;
      if (b.myPosition === null) return 1;
      return a.myPosition - b.myPosition;
    }
    case "due": {
      // Undated tasks always sink to the bottom.
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return (
        (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) * dir
      );
    }
    case "priority":
      return (
        ((PRIORITY_RANK[a.priority] ?? 5) - (PRIORITY_RANK[b.priority] ?? 5)) *
        dir
      );
    case "title":
      return a.title.localeCompare(b.title) * dir;
    case "project":
      return a.projectName.localeCompare(b.projectName) * dir;
    case "created":
      return (
        (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
        dir
      );
  }
}

export function MyTasksTable({
  workspaceId,
  userId,
  tasks,
}: {
  workspaceId: string;
  userId: string;
  tasks: PersonTask[];
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("open");
  const [projectId, setProjectId] = useState(ALL_PROJECTS);
  const [query, setQuery] = useState("");
  const [sort, setSortState] = useState<Sort>(loadSort);
  const setSort = (next: Sort | ((prev: Sort) => Sort)) =>
    setSortState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      saveSort(value);
      return value;
    });
  const manual = sort.key === "manual";
  const setOrder = useSetTaskOrder(workspaceId, userId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const update = useInlineTaskUpdate(workspaceId, userId);

  const projects = useMemo(() => {
    const byId = new Map<string, string>();
    for (const task of tasks) byId.set(task.projectId, task.projectName);
    return [...byId.entries()].sort(([, a], [, b]) => a.localeCompare(b));
  }, [tasks]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [
          f,
          tasks.filter((task) => matches(task, f, userId)).length,
        ]),
      ) as Record<Filter, number>,
    [tasks, userId],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks
      .filter((task) => matches(task, filter, userId))
      .filter(
        (task) => projectId === ALL_PROJECTS || task.projectId === projectId,
      )
      .filter(
        (task) =>
          !needle ||
          task.title.toLowerCase().includes(needle) ||
          `${task.projectSlug}-${task.number}`.toLowerCase().includes(needle),
      )
      .sort((a, b) => compare(a, b, sort));
  }, [tasks, filter, userId, projectId, query, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  const run = (
    task: PersonTask,
    change: Parameters<typeof update.mutate>[0]["change"],
  ) =>
    update.mutate(
      { task, change },
      {
        onError: (error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : t("myWork:table.updateError"),
          ),
      },
    );

  // Rows may be a filtered subset: move the task within the full order, just
  // before or after the row it was dropped on, so hidden tasks keep their place.
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const movingDown =
      rows.findIndex((r) => r.id === overId) >
      rows.findIndex((r) => r.id === activeId);
    const order = [...tasks]
      .sort((a, b) => compare(a, b, MANUAL_SORT))
      .map((task) => task.id)
      .filter((id) => id !== activeId);
    order.splice(order.indexOf(overId) + (movingDown ? 1 : 0), 0, activeId);
    setOrder.mutate(order, {
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : t("myWork:table.orderError"),
        ),
    });
  };

  const projectLabel =
    projectId === ALL_PROJECTS
      ? t("myWork:table.allProjects")
      : (projects.find(([id]) => id === projectId)?.[1] ?? "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label={t("myWork:table.filters")}
          className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                filter === f
                  ? "bg-background font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`myWork:table.filter.${f}`)}
              <span
                className={cn(
                  "rounded px-1 tabular-nums",
                  f === "overdue" && counts[f] > 0
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            aria-pressed={manual}
            onClick={() => setSort(manual ? DEFAULT_SORT : MANUAL_SORT)}
            title={t("myWork:table.myOrderHint")}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors sm:h-7",
              manual
                ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <GripVertical className="size-3.5" />
            {t("myWork:table.myOrder")}
          </button>
          <div className="relative flex-1 sm:w-48 sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              size="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("myWork:table.search")}
              aria-label={t("myWork:table.search")}
              className="pl-7"
            />
          </div>
          <Select
            value={projectId}
            onValueChange={(value) => {
              if (typeof value === "string") setProjectId(value);
            }}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue>{projectLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>
                {t("myWork:table.allProjects")}
              </SelectItem>
              {projects.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-20">{t("myWork:table.col.id")}</th>
              <SortHeader
                label={t("myWork:table.col.task")}
                sortKey="title"
                sort={sort}
                onSort={toggleSort}
              />
              <th className="w-36">{t("myWork:table.col.status")}</th>
              <SortHeader
                label={t("myWork:table.col.priority")}
                sortKey="priority"
                sort={sort}
                onSort={toggleSort}
                className="w-32"
              />
              <SortHeader
                label={t("myWork:table.col.project")}
                sortKey="project"
                sort={sort}
                onSort={toggleSort}
                className="w-40"
              />
              <th className="w-40">{t("myWork:table.col.assignedBy")}</th>
              <SortHeader
                label={t("myWork:table.col.due")}
                sortKey="due"
                sort={sort}
                onSort={toggleSort}
                className="w-28"
              />
              <th className="w-28 text-right!">{t("myWork:table.col.time")}</th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={rows.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-10 text-center text-sm text-muted-foreground"
                    >
                      {tasks.length === 0
                        ? t("people:tasks.empty")
                        : t("myWork:table.noMatch")}
                    </td>
                  </tr>
                ) : (
                  rows.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      workspaceId={workspaceId}
                      userId={userId}
                      canEdit={canEdit}
                      draggable={manual}
                      onChange={(change) => run(task, change)}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <th
      className={className}
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-40")} />
      </button>
    </th>
  );
}

type RowChange = Parameters<
  ReturnType<typeof useInlineTaskUpdate>["mutate"]
>[0]["change"];

function TaskRow({
  task,
  workspaceId,
  userId,
  canEdit,
  draggable,
  onChange,
}: {
  task: PersonTask;
  workspaceId: string;
  userId: string;
  canEdit: boolean;
  draggable: boolean;
  onChange: (change: RowChange) => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !draggable });
  const due = dueState(task);
  const tracked = task.trackedSeconds;
  const estimate = (task.estimateMinutes ?? 0) * 60;
  const ratio = estimate > 0 ? Math.min(tracked / estimate, 1) : 0;

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group transition-colors hover:bg-accent/40 [&>td]:px-3 [&>td]:py-2",
        task.done && "text-muted-foreground",
        isDragging && "relative z-10 bg-background shadow-lg",
      )}
    >
      <td className="text-xs text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1">
          {draggable && (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={t("myWork:table.dragHandle", { title: task.title })}
              className="-ml-1.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground focus-visible:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-3.5" />
            </button>
          )}
          {task.number !== null
            ? `${task.projectSlug}-${task.number}`
            : task.projectSlug}
        </span>
      </td>
      <td className="max-w-0">
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
            className={cn(
              "truncate font-medium hover:underline",
              task.done && "line-through",
            )}
          >
            {task.title}
          </Link>
          {task.subtaskTotal > 0 && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 text-xs tabular-nums",
                task.subtaskDone === task.subtaskTotal
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
              title={t("tasks:progress.hint", {
                done: task.subtaskDone,
                total: task.subtaskTotal,
              })}
            >
              <CircularProgress
                completed={task.subtaskDone}
                total={task.subtaskTotal}
                size={12}
              />
              {task.subtaskDone}/{task.subtaskTotal}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
              title={`${t("tasks:attachments.title")}: ${task.attachmentCount}`}
            >
              <Paperclip className="size-3" />
              {task.attachmentCount}
            </span>
          )}
        </div>
      </td>
      <td>
        <StatusCell task={task} canEdit={canEdit} onChange={onChange} />
      </td>
      <td>
        <PriorityCell task={task} canEdit={canEdit} onChange={onChange} />
      </td>
      <td className="max-w-0">
        <span className="block truncate text-xs text-muted-foreground">
          {task.projectName}
        </span>
      </td>
      <td className="max-w-0">
        {task.assignedById ? (
          <span className="flex items-center gap-1.5 text-xs">
            <Avatar className="size-5">
              <AvatarImage
                src={resolveAvatarSrc(task.assignedByImage ?? undefined)}
                alt=""
              />
              <AvatarFallback className="text-[9px]">
                {getInitials(task.assignedByName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">
              {task.assignedById === userId
                ? t("myWork:table.you")
                : (task.assignedByName ?? t("myWork:table.unknown"))}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td>
        {task.dueDate ? (
          <span
            className={cn(
              "inline-flex rounded-md px-1.5 py-0.5 text-xs tabular-nums",
              due === "overdue" && "bg-destructive/15 text-destructive",
              due === "today" && "bg-warning/15 text-warning-foreground",
              (due === "upcoming" || due === "none") && "text-muted-foreground",
            )}
          >
            {due === "today"
              ? t("myWork:table.today")
              : formatDateShort(task.dueDate)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="text-right text-xs tabular-nums text-muted-foreground">
        {estimate > 0 ? (
          <div className="ml-auto w-20 space-y-1">
            <span className={cn(tracked > estimate && "text-destructive")}>
              {formatHours(tracked)} / {formatHours(estimate)}
            </span>
            <div className="h-1 overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "h-full",
                  tracked > estimate ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
          </div>
        ) : tracked > 0 ? (
          formatHours(tracked)
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

const cellTrigger =
  "inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-accent disabled:hover:bg-transparent";

function StatusCell({
  task,
  canEdit,
  onChange,
}: {
  task: PersonTask;
  canEdit: boolean;
  onChange: (change: RowChange) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = getStatusDisplayLabel(
    task.status,
    task.statusName ?? undefined,
  );
  const content = (
    <>
      {getColumnIcon(task.status, task.done, task.statusIcon)}
      <span className="truncate font-medium">{label}</span>
    </>
  );
  const pill = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 ps-1 pe-2.5 text-xs transition-[filter] hover:brightness-125",
    getStatusPillClass(task.status, task.done, task.statusIcon),
  );
  if (!canEdit) return <span className={pill}>{content}</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" className={pill} />}>
        {content}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {/* Mounted only while open, so columns load per project on demand. */}
        <StatusOptions
          task={task}
          onPick={(change) => {
            setOpen(false);
            if (change.value !== task.status) onChange(change);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function StatusOptions({
  task,
  onPick,
}: {
  task: PersonTask;
  onPick: (change: RowChange & { field: "status" }) => void;
}) {
  const { t } = useTranslation();
  const { data: columns, isLoading } = useGetColumns(task.projectId);
  if (isLoading) {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        {t("myWork:table.loading")}
      </p>
    );
  }
  return (
    <ul>
      {(columns ?? []).map((column) => (
        <li key={column.id}>
          <button
            type="button"
            onClick={() =>
              onPick({
                field: "status",
                value: column.slug,
                label: column.name,
                isFinal: column.isFinal,
              })
            }
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            {getColumnIcon(column.slug, column.isFinal, column.icon)}
            <span className="flex-1 truncate">
              {getStatusDisplayLabel(column.slug, column.name)}
            </span>
            {column.slug === task.status && <Check className="size-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function PriorityCell({
  task,
  canEdit,
  onChange,
}: {
  task: PersonTask;
  canEdit: boolean;
  onChange: (change: RowChange) => void;
}) {
  const [open, setOpen] = useState(false);
  const content = (
    <>
      {getPriorityIcon(task.priority)}
      <span
        className={cn(
          "truncate",
          task.priority === "urgent" && "font-medium text-destructive",
          task.priority === "no-priority" && "text-muted-foreground",
        )}
      >
        {getPriorityLabel(task.priority)}
      </span>
    </>
  );
  if (!canEdit) return <span className={cellTrigger}>{content}</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" className={cellTrigger} />}>
        {content}
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <ul>
          {PRIORITIES.map((priority) => (
            <li key={priority}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (priority !== task.priority) {
                    onChange({ field: "priority", value: priority });
                  }
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {getPriorityIcon(priority)}
                <span className="flex-1">{getPriorityLabel(priority)}</span>
                {priority === task.priority && <Check className="size-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
