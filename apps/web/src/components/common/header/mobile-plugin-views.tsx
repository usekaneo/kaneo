import { useTranslation } from "react-i18next";
import { PluginIcon } from "@/components/plugins/plugin-icon";
import { cn } from "@/lib/cn";
import {
  isSamePluginView,
  type PluginViewRef,
  type ProjectPluginView,
} from "@/lib/plugins/runtime/use-project-plugin-views";

type MobilePluginViewsProps = {
  views: ProjectPluginView[];
  activeView: PluginViewRef | undefined;
  onSelect: (view: PluginViewRef) => void;
};

export function MobilePluginViews({
  views,
  activeView,
  onSelect,
}: MobilePluginViewsProps) {
  const { t } = useTranslation();

  if (views.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {t("tasks:view.heading")}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {views.map((view) => {
          const isActive = isSamePluginView(activeView, view);
          return (
            <button
              key={`${view.pluginId}:${view.viewId}`}
              type="button"
              onClick={() => onSelect(view)}
              aria-pressed={isActive}
              className={cn(
                "flex h-10 w-full items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-border bg-secondary text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-accent",
              )}
            >
              <PluginIcon icon={view.icon} className="size-4 shrink-0" />
              <span className="truncate">{view.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
