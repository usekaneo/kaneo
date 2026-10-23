import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import type { GlobalBoardMeta } from "@/fetchers/task/get-global-board-meta";
import { GlobalBoard } from ".";
import type { GlobalBoardFilters } from "./global-board-filters";
import { GlobalBoardToolbar } from "./global-board-toolbar";
import { useGlobalBoardFilterSubjects } from "./use-global-board-filter-subjects";

type GlobalBoardViewProps = {
  meta: GlobalBoardMeta;
  filters: GlobalBoardFilters;
  onChange: (filters: GlobalBoardFilters) => void;
};

export function GlobalBoardView({
  meta,
  filters,
  onChange,
}: GlobalBoardViewProps) {
  const subjects = useGlobalBoardFilterSubjects(meta, filters, onChange);

  return (
    <>
      <GlobalBoardToolbar
        subjects={subjects}
        filters={filters}
        onChange={onChange}
      />
      <ActiveFiltersBar
        subjects={subjects}
        onClear={() => onChange(filters.q ? { q: filters.q } : {})}
      />
      <GlobalBoard meta={meta} filters={filters} />
    </>
  );
}
