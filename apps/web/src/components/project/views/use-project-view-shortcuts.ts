import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import type { ProjectView } from "./project-views";

export function useProjectViewShortcuts(
  goToView: (view: ProjectView) => void,
  currentView: ProjectView,
  tasksView: ProjectView,
  enabled: boolean,
) {
  useShortcut(
    "toggleLayout",
    () => goToView(currentView === "list" ? "board" : "list"),
    { enabled },
  );
  useShortcut("goToTasks", () => goToView(tasksView), { enabled });
  useShortcut("goToBacklog", () => goToView("backlog"), { enabled });
}
