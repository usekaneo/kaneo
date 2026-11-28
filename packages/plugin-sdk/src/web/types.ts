import type { ComponentType } from "react";

export type IconComponent = ComponentType<{ className?: string }>;

export type ProjectViewProps = {
  workspaceId: string;
  projectId: string;
};

export type TaskPanelProps = {
  workspaceId: string;
  projectId: string;
  taskId: string;
};

export type WorkspacePageProps = {
  workspaceId: string;
};

export type SettingsPanelProps = {
  workspaceId: string;
};

export type ProjectViewScope = "board" | "schedule";

export type ProjectView = {
  id: string;
  title: string;
  icon?: IconComponent;
  shortcut?: string;
  scope?: ProjectViewScope;
  display?: ComponentType<ProjectViewProps>;
  countsTask?: (task: PluginTask) => boolean;
  component: ComponentType<ProjectViewProps>;
};

export type TaskPanel = {
  id: string;
  title: string;
  component: ComponentType<TaskPanelProps>;
};

export type WorkspacePage = {
  id: string;
  title: string;
  icon?: IconComponent;
  component: ComponentType<WorkspacePageProps>;
};

export type CommandContext = {
  workspaceId: string;
  projectId: string | null;
  navigate: (to: string) => void;
};

export type PluginCommand = {
  id: string;
  title: string;
  run: (context: CommandContext) => void | Promise<void>;
};

export type Translations = Record<string, Record<string, unknown>>;

export type WebPluginConfig = {
  projectViews?: ProjectView[];
  taskPanels?: TaskPanel[];
  pages?: WorkspacePage[];
  commands?: PluginCommand[];
  settingsPanel?: ComponentType<SettingsPanelProps>;
  translations?: Translations;
};

export type WebPluginDefinition = WebPluginConfig & {
  readonly kind: "kaneo-web";
  readonly apiVersion: number;
};

export type QueryState<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
};

export type PluginTask = {
  id: string;
  projectId: string;
  number: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
};

export type ProjectViewState = {
  tasks: PluginTask[];
  allTasks: PluginTask[];
  isLoading: boolean;
  error: Error | null;
};

export type PluginProjectColumn = {
  id: string;
  name: string;
  slug: string;
  isFinal: boolean;
};

export type PluginProject = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  columns: PluginProjectColumn[];
};

export type TaskChanges = Partial<{
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
}>;

export type ToastApi = {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
};

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type UserPreferences = {
  weekStartsOn: WeekStartDay;
};

export type PluginApiError = Error & {
  status: number;
  errors?: Record<string, string>;
};

export type PluginUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type PluginInfo<Settings = Record<string, unknown>> = {
  id: string;
  version: string;
  workspaceId: string;
  settings: Settings;
};

export type ApiClient = {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
};

export type TranslateFunction = (
  key: string,
  options?: Record<string, unknown>,
) => string;
