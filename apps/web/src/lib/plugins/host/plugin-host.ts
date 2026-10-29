import { PLUGIN_HOST_GLOBAL } from "@kaneo/plugin-sdk";
import type {
  PluginHost,
  PluginUser,
  ToastApi,
  UserPreferences,
} from "@kaneo/plugin-sdk/web";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { toast } from "@/lib/toast";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { hostComponents } from "./host-components";
import { usePluginScope } from "./plugin-scope-context";
import { useKaneoApi, usePluginApi } from "./use-plugin-api";
import { usePluginOpenTask } from "./use-plugin-open-task";
import { usePluginProjectView } from "./plugin-project-view-context";
import { usePluginProject } from "./use-plugin-project";
import { usePluginTask, usePluginTasks } from "./use-plugin-tasks";
import { usePluginTranslation } from "./use-plugin-translation";
import { usePluginUpdateTask } from "./use-plugin-update-task";

const pluginToast: ToastApi = {
  success: (message) => void toast.success(message),
  error: (message) => void toast.error(message),
  info: (message) => void toast.info(message),
};

function useCurrentUser(): PluginUser | null {
  const { user } = useAuth();
  return useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
          }
        : null,
    [user],
  );
}

function usePreferences(): UserPreferences {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  return useMemo(() => ({ weekStartsOn }), [weekStartsOn]);
}

function usePluginNavigate(): (to: string) => void {
  const navigate = useNavigate();
  return useCallback((to: string) => void navigate({ to }), [navigate]);
}

export const pluginHost: PluginHost = {
  usePlugin: usePluginScope,
  usePluginApi,
  useKaneoApi,
  useTask: usePluginTask,
  useTasks: usePluginTasks,
  useProject: usePluginProject,
  useProjectView: usePluginProjectView,
  useUpdateTask: usePluginUpdateTask,
  useToast: () => pluginToast,
  usePreferences,
  useCurrentUser,
  useT: usePluginTranslation,
  useNavigate: usePluginNavigate,
  useOpenTask: usePluginOpenTask,
  ui: hostComponents,
};

export function installPluginHost(): void {
  (globalThis as Record<string, unknown>)[PLUGIN_HOST_GLOBAL] = pluginHost;
}
