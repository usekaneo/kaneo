import { PLUGIN_HOST_GLOBAL } from "../shared-modules.js";
import type { HostComponents } from "../ui/types.js";
import type {
  ApiClient,
  PluginInfo,
  PluginProject,
  PluginTask,
  PluginUser,
  QueryState,
  TaskChanges,
  ToastApi,
  TranslateFunction,
  UserPreferences,
} from "./types.js";

export type PluginHost = {
  usePlugin(): PluginInfo;
  usePluginApi(): ApiClient;
  useKaneoApi(): ApiClient;
  useTask(taskId: string): QueryState<PluginTask>;
  useTasks(projectId: string): QueryState<PluginTask[]>;
  useProject(projectId: string): QueryState<PluginProject>;
  useUpdateTask(): (taskId: string, changes: TaskChanges) => Promise<void>;
  useToast(): ToastApi;
  usePreferences(): UserPreferences;
  useCurrentUser(): PluginUser | null;
  useT(): TranslateFunction;
  useNavigate(): (to: string) => void;
  useOpenTask(): (taskId: string) => void;
  ui: HostComponents;
};

export function getPluginHost(): PluginHost {
  const host = (globalThis as Record<string, unknown>)[PLUGIN_HOST_GLOBAL];
  if (!host) {
    throw new Error("@kaneo/plugin-sdk/web only works inside Kaneo's web app");
  }
  return host as PluginHost;
}
