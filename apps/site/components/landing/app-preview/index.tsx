"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  subDays,
} from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  SearchIcon,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BoardToolbar from "@/components/project-board-toolbar";
import { PrivateKanbanView } from "@/components/project-private-kanban-view";
import { PrivateListView } from "@/components/project-private-list-view";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { cn } from "@/lib/utils";
import type Task from "@/types/task";
import {
  MOCK_PROJECTS,
  MOCK_USERS,
  MOCK_WORKSPACE,
  MOCK_WORKSPACE_LABELS,
} from "./mock-data";

const PREVIEW_W = 1400;
const PREVIEW_H = 860;

type PreviewMode = "board" | "list" | "gantt";

type ScheduledTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
};

function parseTaskDate(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBarGridColumns(
  scheduleStart: Date,
  scheduleEnd: Date,
  rangeStart: Date,
  trackCount: number,
): { barInView: boolean; lineStart: number; lineEnd: number } {
  const startIndex = differenceInCalendarDays(scheduleStart, rangeStart);
  const endIndex = differenceInCalendarDays(scheduleEnd, rangeStart);
  const barInView = endIndex >= 0 && startIndex < trackCount && trackCount > 0;
  if (!barInView) return { barInView: false, lineStart: 1, lineEnd: 1 };

  const lineStart = Math.max(1, Math.min(startIndex + 1, trackCount));
  const lineEnd = Math.max(
    lineStart + 1,
    Math.min(endIndex + 2, trackCount + 1),
  );

  return { barInView: true, lineStart, lineEnd };
}

function MockGanttTaskBar({
  task,
  timeline,
}: {
  task: ScheduledTask;
  timeline: {
    days: Date[];
    rangeStart: Date;
    gridTemplateColumns: string;
  };
}) {
  const { barInView, lineStart, lineEnd } = getBarGridColumns(
    task.scheduleStart,
    task.scheduleEnd,
    timeline.rangeStart,
    timeline.days.length,
  );

  if (!barInView || lineEnd <= lineStart) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] grid items-center"
      style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
    >
      <div
        style={{ gridColumn: `${lineStart} / ${lineEnd}` }}
        className="group pointer-events-auto relative mx-1 flex h-11 min-w-0 items-stretch overflow-hidden rounded-md border border-primary/25 bg-background text-left text-sm font-medium leading-none text-foreground shadow-sm transition-colors hover:border-primary/40"
      >
        <div className="relative z-20 w-2 shrink-0 border-r border-primary/15 bg-primary/8" />
        <button
          type="button"
          className="relative z-10 min-w-0 flex-1 cursor-grab overflow-hidden px-2.5 text-left active:cursor-grabbing"
        >
          <div className="absolute inset-0 z-0 bg-primary/12 transition-colors group-hover:bg-primary/18" />
          <span className="relative z-10 block truncate">{task.title}</span>
        </button>
        <div className="relative z-20 w-2 shrink-0 border-l border-primary/15 bg-primary/8" />
      </div>
    </div>
  );
}

function MockGanttView({
  project,
}: {
  project: (typeof MOCK_PROJECTS)[number];
}) {
  const dayColumnWidthRem = 2.75;
  const taskColumnWidthRem = 20;

  const statusNames = useMemo(
    () => new Map(project.columns.map((column) => [column.id, column.name])),
    [project.columns],
  );

  const parsedTasks = useMemo(() => {
    return project.columns
      .flatMap((column) => column.tasks)
      .map((task) => {
        const parsedStart =
          parseTaskDate(task.startDate) ?? parseTaskDate(task.dueDate);
        const parsedEnd =
          parseTaskDate(task.dueDate) ?? parseTaskDate(task.startDate);

        if (!parsedStart || !parsedEnd) return null;

        const start = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
        const end = parsedEnd >= parsedStart ? parsedEnd : parsedStart;

        return {
          ...task,
          scheduleStart: start,
          scheduleEnd: end,
        };
      })
      .filter((task): task is ScheduledTask => task !== null)
      .sort(
        (left, right) =>
          left.scheduleStart.getTime() - right.scheduleStart.getTime(),
      );
  }, [project.columns]);

  const timeline = useMemo(() => {
    if (parsedTasks.length === 0) return null;

    const latest = parsedTasks.reduce(
      (current, task) =>
        task.scheduleEnd > current ? task.scheduleEnd : current,
      parsedTasks[0].scheduleEnd,
    );

    const weekEnd = endOfWeek(latest, { weekStartsOn: 1 });
    const today = new Date();
    const rangeStart = subDays(today, 4);
    const rangeEnd = addDays(weekEnd, 21);
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    return {
      days,
      rangeStart,
      gridTemplateColumns: `repeat(${days.length}, minmax(${dayColumnWidthRem}rem, ${dayColumnWidthRem}rem))`,
      timelineMinWidthRem: days.length * dayColumnWidthRem,
    };
  }, [parsedTasks]);

  if (!timeline) return null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Gantt</h2>
          </div>

          <div className="relative w-full max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <div className="flex h-8 items-center rounded-md border border-input bg-background pl-8 pr-3 text-xs text-muted-foreground shadow-xs">
              Search tasks...
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-x-contain">
        <div className="relative min-w-max">
          <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
            <div
              className="sticky left-0 z-30 shrink-0 border-r border-border bg-background px-4 py-3"
              style={{ width: `${taskColumnWidthRem}rem` }}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Task
              </p>
            </div>
            <div
              className="grid shrink-0"
              style={{
                gridTemplateColumns: timeline.gridTemplateColumns,
                minWidth: `${timeline.timelineMinWidthRem}rem`,
              }}
            >
              {timeline.days.map((day, index) => {
                const showMonth =
                  index === 0 ||
                  !isSameMonth(day, timeline.days[index - 1] ?? day);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r border-border/70 px-1 py-2 text-center",
                      isWeekend(day) && "bg-muted/25",
                    )}
                  >
                    <div className="h-4 text-[10px] font-medium text-muted-foreground">
                      {showMonth ? format(day, "MMM") : ""}
                    </div>
                    <div
                      className={cn(
                        "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(day) && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute inset-y-0 z-0 grid"
              style={{
                left: `${taskColumnWidthRem}rem`,
                gridTemplateColumns: timeline.gridTemplateColumns,
                width: `${timeline.timelineMinWidthRem}rem`,
              }}
            >
              {timeline.days.map((day) => (
                <div
                  key={`bg-line-${day.toISOString()}`}
                  className={cn(
                    "h-full min-h-0 border-r border-border/60",
                    isWeekend(day) && "bg-muted/25",
                  )}
                />
              ))}
            </div>

            <div className="relative z-10 flex flex-col">
              {parsedTasks.map((task) => (
                <div
                  key={task.id}
                  className="grid items-stretch border-b border-border/70"
                  style={{
                    gridTemplateColumns: `${taskColumnWidthRem}rem max-content`,
                  }}
                >
                  <div className="sticky left-0 z-[11] h-full border-r border-border bg-background">
                    <button
                      type="button"
                      className="flex w-full min-w-0 flex-col items-start justify-center gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex w-full items-center gap-1.5">
                        <span className="truncate rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                          {statusNames.get(task.status) ?? task.status}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {project.slug}-{task.number}
                        </span>
                      </div>
                      <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-foreground">
                        {task.title}
                      </p>
                      <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
                        {format(task.scheduleStart, "MMM d")} -{" "}
                        {format(task.scheduleEnd, "MMM d")}
                        {task.assigneeName ? ` • ${task.assigneeName}` : ""}
                      </p>
                    </button>
                  </div>

                  <div
                    className="relative h-[50px] shrink-0 select-none"
                    style={{ minWidth: `${timeline.timelineMinWidthRem}rem` }}
                  >
                    <MockGanttTaskBar task={task} timeline={timeline} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MockSidebar — visually identical to app-sidebar.tsx, driven by mock data
// ─────────────────────────────────────────────────────────────────────────────
function MockSidebar({
  activeProjectId,
  onProjectSelect,
}: {
  activeProjectId: string;
  onProjectSelect: (id: string) => void;
}) {
  return (
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      className="border-none pt-1.5"
    >
      {/* Header — WorkspaceSwitcher */}
      <SidebarHeader className="pt-1 pb-1.5">
        <div className="flex items-center justify-between w-full gap-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      className="group h-8 w-full rounded-md px-2 text-sidebar-foreground data-[active=true]:bg-sidebar-accent/50"
                      size="default"
                    />
                  }
                >
                  <div className="flex items-center min-w-0 w-full">
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {MOCK_WORKSPACE.name}
                    </span>
                  </div>
                  <ChevronDown className="ml-1 size-3.5 text-sidebar-foreground/72 opacity-90 transition-all duration-200 ease-out group-hover:opacity-100" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="min-w-40 text-sidebar-foreground"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                    <DropdownMenuItem className="h-7 text-sm data-highlighted:bg-sidebar-accent">
                      {MOCK_WORKSPACE.name}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem className="h-7 text-sm data-highlighted:bg-sidebar-accent">
                      Add workspace
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="h-7 w-7 shrink-0 flex items-center justify-center">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] font-medium">
                AC
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden gap-1 py-1">
        {/* Search (visual only) */}
        <SidebarGroup className="pb-1">
          <button
            type="button"
            className="inline-flex h-8 w-full cursor-pointer rounded-md border border-input bg-background px-2 py-1.5 text-foreground text-sm shadow-xs outline-none transition-[color,box-shadow]"
          >
            <span className="flex grow items-center">
              <SearchIcon
                aria-hidden="true"
                className="-ms-1 me-3 text-muted-foreground/80"
                size={16}
              />
              <span className="font-normal text-muted-foreground/70">
                Search
              </span>
            </span>
            <kbd className="-me-0.5 ms-6 inline-flex h-4 max-h-full items-center rounded border border-border/70 bg-background px-1 font-[inherit] font-medium text-[0.625rem] text-muted-foreground/60">
              ⌘K
            </kbd>
          </button>
        </SidebarGroup>

        {/* NavMain — Overview */}
        <Collapsible defaultOpen>
          <SidebarGroup className="gap-1 p-2">
            <CollapsibleTrigger
              nativeButton={false}
              className="data-panel-open:[&_svg]:rotate-90"
              render={
                <SidebarGroupLabel className="h-7 cursor-pointer justify-between px-0 text-sidebar-accent-foreground" />
              }
            >
              <span>Overview</span>
              <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {["Projects", "Members", "Invitations"].map((title) => (
                    <SidebarMenuItem key={title}>
                      <SidebarMenuButton
                        size="default"
                        className="h-8 ps-3.5 text-sm hover:bg-transparent hover:text-sidebar-accent-foreground active:bg-transparent cursor-default"
                      >
                        <span>{title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsiblePanel>
          </SidebarGroup>
        </Collapsible>

        {/* NavProjects — Projects */}
        <Collapsible defaultOpen>
          <SidebarGroup className="gap-1 p-2 pt-1">
            <CollapsibleTrigger
              nativeButton={false}
              className="data-panel-open:[&_svg]:rotate-90"
              render={
                <SidebarGroupLabel className="h-7 cursor-pointer justify-between px-0 text-sidebar-accent-foreground" />
              }
            >
              <span>Projects</span>
              <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  {MOCK_PROJECTS.map((project) => (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        isActive={project.id === activeProjectId}
                        size="default"
                        className="group/proj h-8 text-sm"
                        onClick={() => onProjectSelect(project.id)}
                      >
                        <span className="truncate">{project.name}</span>

                        <span className="ml-1 h-5 w-5 flex items-center justify-center opacity-0 group-hover/proj:opacity-100 rounded-sm">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsiblePanel>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      {/* Footer — version only */}
      <SidebarFooter>
        <div className="flex items-center justify-center px-2 py-1.5">
          <span className="text-xs text-muted-foreground">v1.0.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppPreview
// ─────────────────────────────────────────────────────────────────────────────
export function AppPreview() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const [activeProjectId, setActiveProjectId] = useState(MOCK_PROJECTS[0].id);
  const [viewMode, setViewMode] = useState<PreviewMode>("board");

  const activeProject =
    MOCK_PROJECTS.find((p) => p.id === activeProjectId) ?? MOCK_PROJECTS[0];

  const {
    filters,
    filteredProject,
    updateFilter,
    updateLabelFilter,
    clearFilters,
    hasActiveFilters,
  } = useTaskFilters(activeProject, activeProjectId);

  const handleProjectSelect = useCallback((id: string) => {
    setActiveProjectId(id);
  }, []);

  const setBoardToolbarMode = useCallback((mode: "board" | "list") => {
    setViewMode(mode);
  }, []);

  // Scale preview to fill the container width; boost on mobile for legibility
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const boost = w < 768 ? 2.5 : 1;
        setScale((w / PREVIEW_W) * boost);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-x-auto md:overflow-x-hidden [-webkit-overflow-scrolling:touch]"
      style={{ height: PREVIEW_H * scale }}
    >
      <div
        style={{
          width: PREVIEW_W,
          height: PREVIEW_H,
          transform: `scale(${scale}) translateZ(0)`,
          transformOrigin: "top left",
          willChange: "transform",
          backfaceVisibility: "hidden" as const,
          WebkitFontSmoothing: "subpixel-antialiased",
        }}
        className="absolute top-0 left-0 overflow-hidden rounded-xl border border-border/70 bg-background shadow-2xl ring-1 ring-black/5"
      >
        <SidebarProvider
          defaultOpen
          style={
            { "--sidebar-width": "14rem", minHeight: 0 } as React.CSSProperties
          }
          className="h-full"
        >
          <MockSidebar
            activeProjectId={activeProjectId}
            onProjectSelect={handleProjectSelect}
          />

          <SidebarInset className="m-2 flex flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm/5">
            {/* ── Project header (matches project-layout.tsx) ───────────── */}
            <header className="h-10 flex shrink-0 items-center gap-2 border-b border-border bg-card px-2">
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {/* Breadcrumb */}
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="text-sm text-muted-foreground truncate">
                      {MOCK_WORKSPACE.name}
                    </span>
                    <span className="text-muted-foreground/70 text-xs">/</span>
                    <span className="text-sm font-medium truncate">
                      {activeProject.name}
                    </span>
                  </div>

                  {/* View switcher */}
                  <div className="h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 inline-flex">
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "h-6 gap-1.5 rounded-md px-2 text-xs",
                        viewMode !== "list" && "text-muted-foreground",
                      )}
                    >
                      <SquircleDashed className="size-3.5" />
                      Backlog
                    </Button>
                    <Button
                      variant={viewMode === "board" ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => setViewMode("board")}
                      className={cn(
                        "h-6 gap-1.5 rounded-md px-2 text-xs",
                        viewMode !== "board" && "text-muted-foreground",
                      )}
                    >
                      <SquareKanban className="size-3.5" />
                      Board
                    </Button>
                    <Button
                      variant={viewMode === "gantt" ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => setViewMode("gantt")}
                      className={cn(
                        "h-6 gap-1.5 rounded-md px-2 text-xs",
                        viewMode !== "gantt" && "text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="size-3.5" />
                      Gantt
                    </Button>
                  </div>
                </div>
              </div>
            </header>

            {/* ── Board Toolbar ─────────────────────────────────────────── */}
            {viewMode !== "gantt" ? (
              <BoardToolbar
                project={activeProject}
                filters={filters}
                updateFilter={updateFilter}
                updateLabelFilter={updateLabelFilter}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
                users={MOCK_USERS}
                workspaceLabels={MOCK_WORKSPACE_LABELS}
                viewMode={viewMode}
                setViewMode={setBoardToolbarMode}
              />
            ) : null}

            {/* ── View content ─────────────────────────────────────────── */}
            <div className="relative flex-1 overflow-hidden flex flex-col min-h-0 bg-linear-to-b from-muted/20 to-background">
              {viewMode === "gantt" ? (
                <MockGanttView project={filteredProject ?? activeProject} />
              ) : viewMode === "board" ? (
                <PrivateKanbanView
                  project={filteredProject ?? activeProject}
                  onTaskClick={() => {}}
                />
              ) : (
                <PrivateListView
                  project={filteredProject ?? activeProject}
                  onTaskClick={() => {}}
                />
              )}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}
