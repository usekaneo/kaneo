import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Rows3,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import {
  isPluginLayoutId,
  type PluginLayoutId,
} from "@/lib/plugins/plugin-layout-id";
import type { TaskLayout } from "@/store/user-preferences";

export type ProjectView =
  | "board"
  | "list"
  | "backlog"
  | "calendar"
  | PluginLayoutId;

export type ProjectRoute = "board" | "backlog" | "calendar" | PluginLayoutId;

export const PROJECT_ROUTE_PATHS = {
  board: "/dashboard/workspace/$workspaceId/project/$projectId/board",
  backlog: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
  calendar: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
} as const;

export const PLUGIN_VIEW_PATH =
  "/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId";

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
  pluginLayouts: readonly PluginLayoutId[],
): ProjectView {
  if (taskLayout === "calendar") return taskLayout;
  if (isPluginLayoutId(taskLayout) && pluginLayouts.includes(taskLayout)) {
    return taskLayout;
  }
  return viewMode;
}
