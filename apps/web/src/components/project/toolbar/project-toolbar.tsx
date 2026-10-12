import type { ReactNode } from "react";
import { DisplayMenu } from "@/components/project/display/display-menu";
import { FilterMenu } from "@/components/project/task-filters/filter-menu";
import { ProjectSearch } from "./project-search";
import type { ProjectTaskView } from "./use-project-task-view";

type ProjectToolbarProps = {
  view: ProjectTaskView;
  display: ReactNode;
  actions?: ReactNode;
};

export function ProjectToolbar({
  view,
  display,
  actions,
}: ProjectToolbarProps) {
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
      <DisplayMenu>{display}</DisplayMenu>
    </>
  );
}
