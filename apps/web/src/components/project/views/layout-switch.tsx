import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { type ProjectView, TASK_LAYOUTS } from "./project-views";

type LayoutSwitchProps = {
  layouts?: typeof TASK_LAYOUTS;
  currentView: ProjectView;
  onSelect: (view: ProjectView) => void;
};

export function LayoutSwitch({
  layouts = TASK_LAYOUTS,
  currentView,
  onSelect,
}: LayoutSwitchProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("tasks:display.layout")}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-border/80 bg-background p-1 dark:bg-input/32"
    >
      {layouts.map((layout) => {
        const Icon = layout.icon;
        const active = layout.id === currentView;
        return (
          <button
            key={layout.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(layout.id)}
            className={cn(
              "flex h-13 flex-col items-center justify-center gap-1 rounded-[calc(var(--radius-lg)-5px)] text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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
