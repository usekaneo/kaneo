import {
  type PluginViewRef,
  pluginLayoutId,
} from "@/lib/plugins/plugin-layout-id";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { type ProjectView, tasksViewFor } from "./project-views";

export function useTasksView(
  pluginViews: readonly PluginViewRef[],
): ProjectView {
  const taskLayout = useUserPreferencesStore((state) => state.taskLayout);
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  return tasksViewFor(taskLayout, viewMode, pluginViews.map(pluginLayoutId));
}
