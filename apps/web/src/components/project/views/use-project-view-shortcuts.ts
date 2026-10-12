import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { type ProjectView, tasksViewFor } from "./project-views";

export function useProjectViewShortcuts(
  goToView: (view: ProjectView) => void,
  currentView: ProjectView,
  enabled: boolean,
) {
  const taskLayout = useUserPreferencesStore((state) => state.taskLayout);
  const viewMode = useUserPreferencesStore((state) => state.viewMode);

  useShortcut(
    "toggleLayout",
    () => goToView(currentView === "list" ? "board" : "list"),
    { enabled },
  );
  useShortcut("goToTasks", () => goToView(tasksViewFor(taskLayout, viewMode)), {
    enabled,
  });
  useShortcut("goToBacklog", () => goToView("backlog"), { enabled });
}
