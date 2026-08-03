import {
  CalendarDays,
  type LucideIcon,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ResolvedSavedView, SavedViewType } from "@/types/saved-view";

export type ProjectView = "backlog" | "board" | "gantt";

type ProjectViewSwitcherProps = {
  views: ResolvedSavedView[];
  activeView: ProjectView;
  onSelect: (viewType: SavedViewType) => void;
};

const viewIcons: Record<SavedViewType, LucideIcon> = {
  list: SquircleDashed,
  board: SquareKanban,
  gantt: CalendarDays,
};

function isActiveView(activeView: ProjectView, viewType: SavedViewType) {
  return activeView === (viewType === "list" ? "backlog" : viewType);
}

export default function ProjectViewSwitcher({
  views,
  activeView,
  onSelect,
}: ProjectViewSwitcherProps) {
  const enabledViews = views.filter((view) => view.enabled);

  if (enabledViews.length === 0) return null;

  return (
    <div className="hidden h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 sm:inline-flex">
      {enabledViews.map((view) => {
        const Icon = viewIcons[view.type] ?? SquircleDashed;
        const isActive = isActiveView(activeView, view.type);

        return (
          <Button
            key={view.key}
            variant={isActive ? "secondary" : "ghost"}
            size="xs"
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(view.type)}
            className={cn(
              "h-6 gap-1.5 rounded-md px-2 text-xs",
              !isActive && "text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span className="max-w-32 truncate" title={view.name}>
              {view.name}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
