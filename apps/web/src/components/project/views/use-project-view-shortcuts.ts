import { useMemo } from "react";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { PROJECT_VIEWS, type ProjectView } from "./project-views";

export function useProjectViewShortcuts(
  goToView: (view: ProjectView) => void,
  enabled: boolean,
) {
  const config = useMemo(() => {
    const viewShortcuts: Record<string, () => void> = Object.fromEntries(
      PROJECT_VIEWS.map((view) => [view.shortcut, () => goToView(view.id)]),
    );
    const sequentialShortcuts: Record<
      string,
      Record<string, () => void>
    > = enabled ? { [shortcuts.view.prefix]: viewShortcuts } : {};
    return { sequentialShortcuts };
  }, [enabled, goToView]);

  useRegisterShortcuts(config);
}
