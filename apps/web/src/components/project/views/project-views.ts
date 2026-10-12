import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChartGantt,
  Rows3,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import type { TaskLayout } from "@/store/user-preferences";

export type ProjectView = "board" | "list" | "backlog" | "calendar" | "gantt";

export type ProjectRoute = "board" | "backlog" | "calendar" | "gantt";

export const PROJECT_ROUTE_PATHS = {
  board: "/dashboard/workspace/$workspaceId/project/$projectId/board",
  backlog: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
  calendar: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
  gantt: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
} as const;

export const PROJECT_VIEWS: ReadonlyArray<{
  id: ProjectView;
  labelKey: string;
  icon: LucideIcon;
}> = [
  {
    id: "board",
    labelKey: "tasks:view.board",
    icon: SquareKanban,
  },
  {
    id: "list",
    labelKey: "tasks:view.list",
    icon: Rows3,
  },
  {
    id: "backlog",
    labelKey: "tasks:view.backlog",
    icon: SquircleDashed,
  },
  {
    id: "calendar",
    labelKey: "tasks:calendar.title",
    icon: CalendarDays,
  },
  {
    id: "gantt",
    labelKey: "tasks:view.gantt",
    icon: ChartGantt,
  },
];

export function routeForView(view: ProjectView): ProjectRoute {
  return view === "list" ? "board" : view;
}

export function resolveProjectView(
  route: ProjectRoute,
  viewMode: "board" | "list",
): ProjectView {
  return route === "board" ? viewMode : route;
}

export const TASK_LAYOUTS = PROJECT_VIEWS.filter(
  (view) => view.id !== "backlog",
);

export function tasksViewFor(
  taskLayout: TaskLayout,
  viewMode: "board" | "list",
): ProjectView {
  return taskLayout === "calendar" || taskLayout === "gantt"
    ? taskLayout
    : viewMode;
}
