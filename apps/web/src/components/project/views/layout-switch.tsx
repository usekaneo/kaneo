import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PluginIcon } from "@/components/plugins/plugin-icon";
import { cn } from "@/lib/cn";
import { pluginLayoutId } from "@/lib/plugins/plugin-layout-id";
import { useProjectPluginViews } from "@/lib/plugins/runtime/use-project-plugin-views";
import { layoutColumns } from "./layout-columns";
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

type LayoutOption = {
  id: ProjectView;
  label: string;
  icon: ReactNode;
};

export function LayoutSwitch({
  workspaceId,
  projectId,
  currentRoute,
  currentView,
}: LayoutSwitchProps) {
  const { t } = useTranslation();
  const goToView = useGoToProjectView({ workspaceId, projectId, currentRoute });
  const pluginViews = useProjectPluginViews(workspaceId, projectId);
  const layouts: LayoutOption[] = [
    ...TASK_LAYOUTS.map(({ id, labelKey, icon: Icon }) => ({
      id,
      label: t(labelKey),
      icon: <Icon className="size-4" />,
    })),
    ...pluginViews.map((view) => ({
      id: pluginLayoutId(view),
      label: view.title,
      icon: <PluginIcon icon={view.icon} className="size-4" />,
    })),
  ];

  return (
    <div
      role="group"
      aria-label={t("tasks:display.layout")}
      className="grid gap-1 rounded-lg border border-border/80 bg-background p-1 dark:bg-input/32"
      style={{
        gridTemplateColumns: `repeat(${layoutColumns(layouts.length)}, minmax(0, 1fr))`,
      }}
    >
      {layouts.map((layout) => {
        const active = layout.id === currentView;
        return (
          <button
            key={layout.id}
            type="button"
            aria-pressed={active}
            onClick={() => goToView(layout.id)}
            className={cn(
              "flex h-13 min-w-0 flex-col items-center justify-center gap-1 rounded-[calc(var(--radius-lg)-5px)] px-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <span aria-hidden="true" className="flex">
              {layout.icon}
            </span>
            <span className="max-w-full truncate">{layout.label}</span>
          </button>
        );
      })}
    </div>
  );
}
