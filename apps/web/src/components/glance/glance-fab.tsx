import { useNavigate } from "@tanstack/react-router";
import {
  BookmarkIcon,
  CalendarDaysIcon,
  ChevronsUpDownIcon,
  LayoutGridIcon,
  ListChecksIcon,
  PlusIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import type {
  GlanceFilterState,
  GlanceMember,
  GlanceSavedView,
  GlanceTask,
} from "@/fetchers/glance/types";
import { useCreateGlanceView } from "@/hooks/mutations/glance/use-create-glance-view";
import { useDeleteGlanceView } from "@/hooks/mutations/glance/use-delete-glance-view";
import { useUpdateGlancePrefs } from "@/hooks/mutations/glance/use-update-glance-prefs";
import { useGlanceFilters } from "@/hooks/queries/glance/use-glance-filters";
import { useGlanceMembers } from "@/hooks/queries/glance/use-glance-members";
import { useGlancePrefs } from "@/hooks/queries/glance/use-glance-prefs";
import { useGlanceTasks } from "@/hooks/queries/glance/use-glance-tasks";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

// ─── Constants ────────────────────────────────────────────────────────────────

const DUE_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due within 7 days" },
  { value: "none", label: "No due date" },
] as const;

const GROUP_BY_OPTIONS = [
  { value: "workspace", label: "Workspace" },
  { value: "project", label: "Project" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
] as const;

// Shared visual class for all filter trigger buttons
const FILTER_BTN =
  "inline-flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-left text-sm text-foreground shadow-xs/5 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:w-auto sm:text-xs";
const FILTER_ACTIVE = "border-primary/50 bg-primary/5";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a comma-separated filter string into an array of values. */
function parseMulti(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse assignees string, defaulting to ["me"] when empty. */
function parseAssignees(raw: string | undefined): string[] {
  const parsed = parseMulti(raw);
  return parsed.length ? parsed : ["me"];
}

/** Format a multi-select selection into a trigger label. */
function multiLabel(
  selected: string[],
  options: readonly { value: string; label: string }[],
  placeholder: string,
): string {
  if (selected.length === 0) return placeholder;
  const first =
    options.find((o) => o.value === selected[0])?.label ?? selected[0];
  if (selected.length === 1) return first;
  return `${first}, +${selected.length - 1}`;
}

/** Format assignee list for the trigger label. */
function assigneesLabel(
  selected: string[],
  members: GlanceMember[],
  currentUserId: string,
): string {
  if (
    selected.length === 0 ||
    (selected.length === 1 && selected[0] === "me")
  ) {
    return "Me";
  }
  const names = selected.map((id) => {
    if (id === "me" || id === currentUserId) return "Me";
    return members.find((m) => m.id === id)?.name ?? id;
  });
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, +${names.length - 1}`;
}

/** Group a flat task list into labelled sections. */
function groupTasks(
  tasks: GlanceTask[],
  groupBy: string,
): Array<{ key: string; label: string; tasks: GlanceTask[] }> {
  const map = new Map<string, { label: string; tasks: GlanceTask[] }>();

  for (const task of tasks) {
    let key: string;
    let label: string;

    switch (groupBy) {
      case "project":
        key = task.projectId;
        label = `${task.workspaceName} / ${task.projectName}`;
        break;
      case "priority":
        key = task.priority ?? "no-priority";
        label = getPriorityLabel(task.priority ?? "no-priority");
        break;
      case "due": {
        if (!task.dueDate) {
          key = "no-due";
          label = "No due date";
        } else {
          const d = new Date(task.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          const in7Days = new Date(today);
          in7Days.setDate(today.getDate() + 7);
          if (d < today) {
            key = "overdue";
            label = "Overdue";
          } else if (d < tomorrow) {
            key = "today";
            label = "Due today";
          } else if (d < in7Days) {
            key = "week";
            label = "Due within 7 days";
          } else {
            key = "later";
            label = "Later";
          }
        }
        break;
      }
      default: // workspace
        key = task.workspaceId;
        label = task.workspaceName;
    }

    const existing = map.get(key);
    if (existing) {
      existing.tasks.push(task);
    } else {
      map.set(key, { label, tasks: [task] });
    }
  }

  return Array.from(map.entries()).map(([key, { label, tasks }]) => ({
    key,
    label,
    tasks,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {name}
    </span>
  );
}

function AssigneeAvatar({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image: string | null;
  size?: "sm" | "xs";
}) {
  const sizeClass = size === "xs" ? "size-4 text-[9px]" : "size-5 text-[10px]";
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={cn("rounded-full object-cover", sizeClass)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
        sizeClass,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function TaskRow({
  task,
  showAssignee,
  onNavigate,
}: {
  task: GlanceTask;
  showAssignee: boolean;
  onNavigate: (task: GlanceTask) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(task)}
      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
    >
      <span className="mt-0.5 inline-flex shrink-0 items-center">
        {getPriorityIcon(task.priority ?? "no-priority")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">
          {task.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {task.projectName}
          </span>
          {task.dueDate && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <CalendarDaysIcon className="size-3" />
              {new Date(task.dueDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {task.labels.map((l) => (
            <LabelChip key={l.name} name={l.name} color={l.color} />
          ))}
        </span>
      </span>
      {showAssignee && (
        <span className="mt-0.5 shrink-0" title={task.assigneeName}>
          <AssigneeAvatar
            name={task.assigneeName}
            image={task.assigneeImage}
            size="xs"
          />
        </span>
      )}
    </button>
  );
}

/** Single-select filter — same pill style as multi-select, radio semantics. */
function SingleSelectFilter({
  placeholder,
  options,
  value,
  onChange,
}: {
  placeholder: string;
  options: readonly { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const isActive = !!value;
  const label = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(FILTER_BTN, isActive && FILTER_ACTIVE)}
        >
          <span className="flex-1 truncate">{label}</span>
          <ChevronsUpDownIcon className="-me-0.5 size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
              value === opt.value && "font-medium text-foreground",
            )}
            onClick={() =>
              onChange(value === opt.value ? undefined : opt.value)
            }
          >
            <span
              className={cn(
                "size-3.5 shrink-0 rounded-full border",
                value === opt.value
                  ? "border-primary bg-primary"
                  : "border-input",
              )}
            />
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Generic multi-select filter — Popover with labelled checkboxes.
 * Uses <label> wrappers (implicit association) so the full row is clickable
 * without nesting interactive elements inside a <button>.
 */
function MultiSelectFilter({
  placeholder,
  options,
  selected,
  onToggle,
  onClear,
  onSelectAll,
}: {
  placeholder: string;
  options: readonly {
    value: string;
    label: string;
    prefix?: ReactNode;
  }[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  onSelectAll?: (values: string[]) => void;
}) {
  const isActive = selected.length > 0;
  const label = multiLabel(selected, options, placeholder);
  const allValues = options.map((o) => o.value);
  const allSelected = allValues.every((v) => selected.includes(v));

  function handleLabelClick(e: React.MouseEvent, value: string) {
    if (e.shiftKey && onSelectAll) {
      e.preventDefault();
      allSelected ? onClear() : onSelectAll(allValues);
    } else {
      onToggle(value);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(FILTER_BTN, isActive && FILTER_ACTIVE)}
        >
          <span className="flex-1 truncate">{label}</span>
          <ChevronsUpDownIcon className="-me-0.5 size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        {isActive && (
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-sm px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
          >
            Clear selection
          </button>
        )}
        {options.map((opt) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox renders as a button, not a native input
          // biome-ignore lint/a11y/useKeyWithClickEvents: shift-click is a progressive enhancement; keyboard users use the checkbox directly
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent"
            onClick={(e) => handleLabelClick(e, opt.value)}
          >
            <Checkbox
              checked={selected.includes(opt.value)}
              onCheckedChange={() => onToggle(opt.value)}
            />
            {opt.prefix}
            <span className="min-w-0 truncate text-sm">{opt.label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Assignee multi-select — same Popover + label pattern with avatars. */
function AssigneeFilter({
  selected,
  members,
  currentUserId,
  onChange,
}: {
  selected: string[];
  members: GlanceMember[];
  currentUserId: string;
  onChange: (next: string[]) => void;
}) {
  const label = assigneesLabel(selected, members, currentUserId);
  const isActive =
    selected.length > 1 || (selected.length === 1 && selected[0] !== "me");

  const allIds = members.map((m) => (m.id === currentUserId ? "me" : m.id));
  const allSelected = allIds.every((id) => selected.includes(id));

  function toggle(id: string) {
    const norm = id === currentUserId ? "me" : id;
    const next = selected.includes(norm)
      ? selected.filter((x) => x !== norm)
      : [...selected, norm];
    onChange(next.length ? next : ["me"]);
  }

  function isChecked(id: string) {
    const norm = id === currentUserId ? "me" : id;
    return selected.includes(norm);
  }

  function handleLabelClick(e: React.MouseEvent, id: string) {
    if (e.shiftKey) {
      e.preventDefault();
      allSelected ? onChange(["me"]) : onChange(allIds);
    } else {
      toggle(id);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(FILTER_BTN, isActive && FILTER_ACTIVE)}
        >
          <UserIcon className="size-3.5 shrink-0 opacity-60" />
          <span className="flex-1 truncate">{label}</span>
          <ChevronsUpDownIcon className="-me-0.5 size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        {members.map((member) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox renders as a button, not a native input
          // biome-ignore lint/a11y/useKeyWithClickEvents: shift-click is a progressive enhancement; keyboard users use the checkbox directly
          <label
            key={member.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent"
            onClick={(e) => handleLabelClick(e, member.id)}
          >
            <Checkbox
              checked={isChecked(member.id)}
              onCheckedChange={() => toggle(member.id)}
            />
            <AssigneeAvatar name={member.name} image={member.image} size="xs" />
            <span className="min-w-0 truncate text-sm">
              {member.id === currentUserId ? "Me" : member.name}
            </span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ViewChip({
  view,
  isActive,
  onApply,
  onDelete,
}: {
  view: GlanceSavedView;
  isActive: boolean;
  onApply: () => void;
  onDelete: () => void;
}) {
  return (
    <span
      className={cn(
        "group inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        isActive
          ? FILTER_ACTIVE
          : "border-input bg-background text-foreground hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={onApply}
        className="max-w-32 truncate focus-visible:outline-none"
      >
        {view.name}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="ml-0.5 hidden rounded-full p-0.5 text-muted-foreground hover:text-foreground group-hover:inline-flex focus-visible:outline-none"
        aria-label={`Delete view "${view.name}"`}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

function SaveViewPopover({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-input px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none"
        >
          <PlusIcon className="size-3" />
          Save view
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <p className="mb-1.5 text-xs font-medium text-foreground">
          Name this view
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="e.g. Sprint focus"
          className="mb-2 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          Save
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GlanceFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  // Prefs — load on open, sync into local filter state once per open
  const { data: savedPrefs } = useGlancePrefs(open);
  const [filterState, setFilterState] = useState<GlanceFilterState>({
    filters: {},
    groupBy: "workspace",
  });
  const [views, setViews] = useState<GlanceSavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const prefsApplied = useRef(false);

  useEffect(() => {
    if (savedPrefs && !prefsApplied.current) {
      setFilterState({
        filters: savedPrefs.filters,
        groupBy: savedPrefs.groupBy,
      });
      const loadedViews = savedPrefs.views ?? [];
      setViews(loadedViews);

      const norm = (f: Record<string, string>) =>
        JSON.stringify(Object.fromEntries(Object.entries(f).sort()));
      const matched = loadedViews.find(
        (v) =>
          norm(v.filters) === norm(savedPrefs.filters) &&
          v.groupBy === savedPrefs.groupBy,
      );
      if (matched) setActiveViewId(matched.id);

      prefsApplied.current = true;
    }
  }, [savedPrefs]);

  useEffect(() => {
    if (!open) {
      prefsApplied.current = false;
      setActiveViewId(null);
    }
  }, [open]);

  const { data: filterOptions } = useGlanceFilters(open);
  const { data: members = [] } = useGlanceMembers(open);
  const { data: tasks, isLoading: tasksLoading } = useGlanceTasks(
    filterState.filters,
    open,
  );
  const { mutate: savePrefs } = useUpdateGlancePrefs();
  const { mutate: createView } = useCreateGlanceView();
  const { mutate: deleteView } = useDeleteGlanceView();

  // ── Filter state helpers ────────────────────────────────────────────────────
  // NOTE: savePrefs must be called at the top level — never inside a setState
  // callback. React 19 may invoke state updaters multiple times (Strict Mode),
  // which would fire the mutation more than once and can silently drop saves.

  /** Set a single-value filter (or clear it when value is "all" / empty). */
  const updateFilter = useCallback(
    (key: string, value: string) => {
      const shouldClear = !value || value === "all";
      const nextFilters = shouldClear
        ? (() => {
            const f = { ...filterState.filters };
            delete f[key];
            return f;
          })()
        : { ...filterState.filters, [key]: value };
      const next: GlanceFilterState = { ...filterState, filters: nextFilters };
      setFilterState(next);
      setActiveViewId(null);
      savePrefs(next);
    },
    [filterState, savePrefs],
  );

  /** Toggle one value inside a multi-select filter (stored comma-separated). */
  const toggleMultiFilter = useCallback(
    (key: string, value: string) => {
      const current = parseMulti(filterState.filters[key]);
      const nextArr = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const nextFilters =
        nextArr.length === 0
          ? (() => {
              const f = { ...filterState.filters };
              delete f[key];
              return f;
            })()
          : { ...filterState.filters, [key]: nextArr.join(",") };
      const next: GlanceFilterState = { ...filterState, filters: nextFilters };
      setFilterState(next);
      setActiveViewId(null);
      savePrefs(next);
    },
    [filterState, savePrefs],
  );

  /** Clear all selections for a multi-select filter. */
  const clearMultiFilter = useCallback(
    (key: string) => {
      const f = { ...filterState.filters };
      delete f[key];
      const next: GlanceFilterState = { ...filterState, filters: f };
      setFilterState(next);
      setActiveViewId(null);
      savePrefs(next);
    },
    [filterState, savePrefs],
  );

  /** Replace all selections for a multi-select filter at once. */
  const setMultiFilter = useCallback(
    (key: string, values: string[]) => {
      const nextFilters = { ...filterState.filters, [key]: values.join(",") };
      const next: GlanceFilterState = { ...filterState, filters: nextFilters };
      setFilterState(next);
      setActiveViewId(null);
      savePrefs(next);
    },
    [filterState, savePrefs],
  );

  const updateAssignees = useCallback(
    (assignees: string[]) => {
      const shouldClear =
        assignees.length === 0 ||
        (assignees.length === 1 && assignees[0] === "me");
      const nextFilters = shouldClear
        ? (() => {
            const f = { ...filterState.filters };
            delete f.assignees;
            return f;
          })()
        : { ...filterState.filters, assignees: assignees.join(",") };
      const next: GlanceFilterState = { ...filterState, filters: nextFilters };
      setFilterState(next);
      setActiveViewId(null);
      savePrefs(next);
    },
    [filterState, savePrefs],
  );

  const updateGroupBy = useCallback(
    (value: string) => {
      const next: GlanceFilterState = { ...filterState, groupBy: value };
      setFilterState(next);
      setActiveViewId(null);
      savePrefs(next);
    },
    [filterState, savePrefs],
  );

  const applyView = useCallback(
    (view: GlanceSavedView) => {
      const next: GlanceFilterState = {
        filters: view.filters,
        groupBy: view.groupBy,
      };
      setFilterState(next);
      setActiveViewId(view.id);
      savePrefs(next);
    },
    [savePrefs],
  );

  const handleCreateView = useCallback(
    (name: string) => {
      createView(
        { name, state: filterState },
        {
          onSuccess: (updated) => {
            setViews(updated.views ?? []);
            const newView = updated.views?.find((v) => v.name === name);
            if (newView) setActiveViewId(newView.id);
          },
        },
      );
    },
    [createView, filterState],
  );

  const handleDeleteView = useCallback(
    (viewId: string) => {
      deleteView(viewId, {
        onSuccess: (updated) => {
          setViews(updated.views ?? []);
          if (activeViewId === viewId) setActiveViewId(null);
        },
      });
    },
    [deleteView, activeViewId],
  );

  // ── Derived state ───────────────────────────────────────────────────────────

  const selectedAssignees = useMemo(
    () => parseAssignees(filterState.filters.assignees),
    [filterState.filters.assignees],
  );

  const multipleAssignees =
    selectedAssignees.length > 1 ||
    (selectedAssignees.length === 1 && selectedAssignees[0] !== "me");

  const selectedWorkspaces = useMemo(
    () => parseMulti(filterState.filters.workspaceId),
    [filterState.filters.workspaceId],
  );

  const selectedProjects = useMemo(
    () => parseMulti(filterState.filters.project),
    [filterState.filters.project],
  );

  const selectedLabels = useMemo(
    () => parseMulti(filterState.filters.label),
    [filterState.filters.label],
  );

  const selectedPriorities = useMemo(
    () => parseMulti(filterState.filters.priority),
    [filterState.filters.priority],
  );

  // Projects visible in the Projects filter (restricted by selected workspaces)
  const visibleProjects = useMemo(() => {
    if (!filterOptions) return [];
    return selectedWorkspaces.length
      ? filterOptions.projects.filter((p) =>
          selectedWorkspaces.includes(p.workspaceId),
        )
      : filterOptions.projects;
  }, [filterOptions, selectedWorkspaces]);

  const groups = useMemo(
    () => groupTasks(tasks ?? [], filterState.groupBy),
    [tasks, filterState.groupBy],
  );

  const handleNavigate = useCallback(
    (task: GlanceTask) => {
      setOpen(false);
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
        params: { workspaceId: task.workspaceId, projectId: task.projectId },
        search: { taskId: task.taskId },
      });
    },
    [navigate],
  );

  // Keyboard shortcut: Ctrl/Cmd + Shift + G
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "g"
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── Option arrays for MultiSelectFilter ────────────────────────────────────

  const workspaceOptions = useMemo(
    () =>
      (filterOptions?.workspaces ?? []).map((w) => ({
        value: w.id,
        label: w.name,
      })),
    [filterOptions],
  );

  const projectOptions = useMemo(
    () => visibleProjects.map((p) => ({ value: p.id, label: p.name })),
    [visibleProjects],
  );

  const labelOptions = useMemo(
    () =>
      (filterOptions?.labels ?? []).map((l) => ({
        value: l.name,
        label: l.name,
        prefix: (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: l.color }}
          />
        ),
      })),
    [filterOptions],
  );

  const priorityOptions = useMemo(
    () =>
      (filterOptions?.priorities ?? ["urgent", "high", "medium", "low"]).map(
        (p) => ({
          value: p,
          label: getPriorityLabel(p),
          prefix: getPriorityIcon(p),
        }),
      ),
    [filterOptions],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Glance — my tasks"
            title="Glance — my tasks (Ctrl+Shift+G)"
            className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        }
      >
        <ListChecksIcon className="size-5" />
      </DialogTrigger>

      <DialogPopup className="max-w-2xl" showCloseButton>
        <DialogHeader>
          {/* Title row with Group by selector on the right */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <DialogTitle className="flex items-center gap-2">
              <ListChecksIcon className="size-4.5" />
              My tasks
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                Group by
              </span>
              <Select
                value={filterState.groupBy}
                onValueChange={(v) => updateGroupBy(v as string)}
              >
                <SelectTrigger size="sm" className="w-auto min-w-28">
                  <LayoutGridIcon className="size-3.5 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_BY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Saved views row */}
          {(views.length > 0 ||
            Object.keys(filterState.filters).length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <BookmarkIcon className="size-3 shrink-0 text-muted-foreground/60" />
              {views.map((view) => (
                <ViewChip
                  key={view.id}
                  view={view}
                  isActive={activeViewId === view.id}
                  onApply={() => applyView(view)}
                  onDelete={() => handleDeleteView(view.id)}
                />
              ))}
              <SaveViewPopover onSave={handleCreateView} />
            </div>
          )}

          {/* Filter bar — 2-col grid on mobile, flex-wrap row on sm+ */}
          {filterOptions && (
            <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:flex-wrap">
              <MultiSelectFilter
                placeholder="All workspaces"
                options={workspaceOptions}
                selected={selectedWorkspaces}
                onToggle={(v) => {
                  // Compute new workspace selection
                  const nextWs = selectedWorkspaces.includes(v)
                    ? selectedWorkspaces.filter((x) => x !== v)
                    : [...selectedWorkspaces, v];

                  // Build updated filters in one go so we only call setFilterState
                  // and savePrefs once (never inside a setState callback).
                  const f: Record<string, string> = { ...filterState.filters };
                  if (nextWs.length === 0) {
                    delete f.workspaceId;
                  } else {
                    f.workspaceId = nextWs.join(",");
                  }

                  // Drop any selected projects that no longer belong to the new workspace set
                  if (nextWs.length && selectedProjects.length) {
                    const valid = filterOptions.projects
                      .filter((p) => nextWs.includes(p.workspaceId))
                      .map((p) => p.id);
                    const kept = selectedProjects.filter((id) =>
                      valid.includes(id),
                    );
                    if (kept.length === 0) {
                      delete f.project;
                    } else if (kept.length !== selectedProjects.length) {
                      f.project = kept.join(",");
                    }
                  }

                  const next: GlanceFilterState = {
                    ...filterState,
                    filters: f,
                  };
                  setFilterState(next);
                  setActiveViewId(null);
                  savePrefs(next);
                }}
                onClear={() => clearMultiFilter("workspaceId")}
                onSelectAll={(values) => setMultiFilter("workspaceId", values)}
              />

              <MultiSelectFilter
                placeholder="All projects"
                options={projectOptions}
                selected={selectedProjects}
                onToggle={(v) => toggleMultiFilter("project", v)}
                onClear={() => clearMultiFilter("project")}
                onSelectAll={(values) => setMultiFilter("project", values)}
              />

              <SingleSelectFilter
                placeholder="Any date"
                options={DUE_OPTIONS}
                value={filterState.filters.due || undefined}
                onChange={(v) => updateFilter("due", v ?? "")}
              />

              {labelOptions.length > 0 && (
                <MultiSelectFilter
                  placeholder="Any label"
                  options={labelOptions}
                  selected={selectedLabels}
                  onToggle={(v) => toggleMultiFilter("label", v)}
                  onClear={() => clearMultiFilter("label")}
                  onSelectAll={(values) => setMultiFilter("label", values)}
                />
              )}

              {members.length > 0 && (
                <AssigneeFilter
                  selected={selectedAssignees}
                  members={members}
                  currentUserId={currentUserId}
                  onChange={updateAssignees}
                />
              )}

              <MultiSelectFilter
                placeholder="Any priority"
                options={priorityOptions}
                selected={selectedPriorities}
                onToggle={(v) => toggleMultiFilter("priority", v)}
                onClear={() => clearMultiFilter("priority")}
                onSelectAll={(values) => setMultiFilter("priority", values)}
              />
            </div>
          )}
        </DialogHeader>

        <div
          className="overflow-y-auto px-6 pb-6 pt-1"
          style={{ maxHeight: "calc(80vh - 10rem)" }}
        >
          {tasksLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <ListChecksIcon className="size-8 opacity-40" />
              <span className="text-sm">
                No open tasks match the current filters
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                    <span className="ml-1.5 font-normal normal-case tabular-nums">
                      ({group.tasks.length})
                    </span>
                  </p>
                  <div>
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.taskId}
                        task={task}
                        showAssignee={multipleAssignees}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
