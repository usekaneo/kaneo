import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  type ProjectRoute,
  type ProjectView,
  TASK_LAYOUTS,
} from "./project-views";
import { useGoToProjectView } from "./use-go-to-project-view";

type LayoutSwitchProps = {
  workspaceId: string;
  projectId: string;
  currentRoute: ProjectRoute;
  currentView: ProjectView;
};

export function LayoutSwitch({
  workspaceId,
  projectId,
  currentRoute,
  currentView,
}: LayoutSwitchProps) {
  const { t } = useTranslation();
  const goToView = useGoToProjectView({ workspaceId, projectId, currentRoute });

  return (
    <div
      role="group"
      aria-label={t("tasks:display.layout")}
      className="grid grid-cols-4 gap-1 rounded-lg border border-border/80 bg-background p-1 dark:bg-input/32"
    >
      {TASK_LAYOUTS.map((layout) => {
        const Icon = layout.icon;
        const active = layout.id === currentView;
        return (
          <button
            key={layout.id}
            type="button"
            aria-pressed={active}
            onClick={() => goToView(layout.id)}
            className={cn(
              "flex h-13 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(layout.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
