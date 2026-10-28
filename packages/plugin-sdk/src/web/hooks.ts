import { getPluginHost } from "./host.js";
import type {
  ApiClient,
  PluginInfo,
  PluginProject,
  PluginTask,
  PluginUser,
  ProjectViewState,
  QueryState,
  TaskChanges,
  ToastApi,
  TranslateFunction,
  UserPreferences,
} from "./types.js";

export function usePlugin<
  Settings = Record<string, unknown>,
>(): PluginInfo<Settings> {
  return getPluginHost().usePlugin() as PluginInfo<Settings>;
}

export function usePluginApi(): ApiClient {
  return getPluginHost().usePluginApi();
}

export function useKaneoApi(): ApiClient {
  return getPluginHost().useKaneoApi();
}

export function useTask(taskId: string): QueryState<PluginTask> {
  return getPluginHost().useTask(taskId);
}

export function useTasks(projectId: string): QueryState<PluginTask[]> {
  return getPluginHost().useTasks(projectId);
}

export function useProject(projectId: string): QueryState<PluginProject> {
  return getPluginHost().useProject(projectId);
}

export function useProjectView(): ProjectViewState {
  return getPluginHost().useProjectView();
}

export function useUpdateTask(): (
  taskId: string,
  changes: TaskChanges,
) => Promise<void> {
  return getPluginHost().useUpdateTask();
}

export function useToast(): ToastApi {
  return getPluginHost().useToast();
}

export function usePreferences(): UserPreferences {
  return getPluginHost().usePreferences();
}

export function useCurrentUser(): PluginUser | null {
  return getPluginHost().useCurrentUser();
}

export function useT(): TranslateFunction {
  return getPluginHost().useT();
}

export function useNavigate(): (to: string) => void {
  return getPluginHost().useNavigate();
}

export function useOpenTask(): (taskId: string) => void {
  return getPluginHost().useOpenTask();
}
