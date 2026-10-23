import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterMenu } from "@/components/project/task-filters/filter-menu";
import type { FilterSubject } from "@/components/project/task-filters/filter-subject";
import { useFilterShortcuts } from "@/components/project/task-filters/use-filter-shortcuts";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  countActiveFilters,
  type GlobalBoardFilters,
} from "./global-board-filters";

type GlobalBoardToolbarProps = {
  subjects: FilterSubject[];
  filters: GlobalBoardFilters;
  onChange: (filters: GlobalBoardFilters) => void;
};

export function GlobalBoardToolbar({
  subjects,
  filters,
  onChange,
}: GlobalBoardToolbarProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(filters.q ?? "");
  const debouncedSearch = useDebouncedValue(search, 250);

  // Apply typing once it settles; other filter changes must not replay it.
  const latest = useRef({ filters, onChange });
  latest.current = { filters, onChange };
  useEffect(() => {
    const q = debouncedSearch.trim() || undefined;
    const { filters, onChange } = latest.current;
    if (q !== filters.q) onChange({ ...filters, q });
  }, [debouncedSearch]);

  // Search text lives beside the filters, so clearing them keeps it.
  useFilterShortcuts(subjects, () =>
    onChange(filters.q ? { q: filters.q } : {}),
  );

  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-1 md:px-5">
      <div className="relative min-w-0 flex-1 sm:max-w-64">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          size="sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("tasks:globalBoard.searchPlaceholder")}
          aria-label={t("tasks:globalBoard.searchPlaceholder")}
          className="[&_input]:ps-8"
        />
      </div>
      <FilterMenu
        subjects={subjects}
        activeCount={countActiveFilters(filters)}
      />
    </div>
  );
}
