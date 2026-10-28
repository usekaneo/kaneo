import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DisplaySection } from "@/components/project/display/display-section";
import { DisplayMenu } from "@/components/project/display/display-menu";
import { FilterMenu } from "@/components/project/task-filters/filter-menu";
import { useFilterShortcuts } from "@/components/project/task-filters/use-filter-shortcuts";
import { ProjectSearch } from "./project-search";
import type { ProjectTaskView } from "./use-project-task-view";

/** What the toolbar needs from a task view; workspace views provide the same. */
export type ToolbarView = Pick<
  ProjectTaskView,
  "search" | "setSearch" | "subjects"
> & {
  filters: Pick<
    ProjectTaskView["filters"],
    | "clearFilters"
    | "activeFilterCount"
    | "includeSubtasks"
    | "setIncludeSubtasks"
    | "hasIncludeSubtasksOverride"
  >;
};

type ProjectToolbarProps = {
  view: ToolbarView;
  display: ReactNode;
  actions?: ReactNode;
  /** The workspace view has no project default to fall back to. */
  hideSubtaskToggle?: boolean;
};

export function ProjectToolbar({
  view,
  display,
  actions,
  hideSubtaskToggle = false,
}: ProjectToolbarProps) {
  const { t } = useTranslation();
  const includeSubtasksId = useId();
  useFilterShortcuts(view.subjects, view.filters.clearFilters);

  return (
    <>
      {actions && (
        <>
          {actions}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        </>
      )}
      <ProjectSearch value={view.search} onChange={view.setSearch} />
      <FilterMenu
        subjects={view.subjects}
        activeCount={view.filters.activeFilterCount}
      />
      <DisplayMenu>
        {!hideSubtaskToggle && (
          <DisplaySection>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={includeSubtasksId} className="text-sm">
                {t("tasks:display.includeSubtasks")}
              </label>
              <Switch
                id={includeSubtasksId}
                checked={view.filters.includeSubtasks}
                onCheckedChange={view.filters.setIncludeSubtasks}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!view.filters.hasIncludeSubtasksOverride}
              onClick={() => view.filters.setIncludeSubtasks(null)}
            >
              {t("tasks:display.useProjectDefault")}
            </Button>
          </DisplaySection>
        )}
        {display}
      </DisplayMenu>
    </>
  );
}
