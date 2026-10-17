import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ActiveFilterChip } from "./active-filter-chip";
import { AddFilterButton } from "./add-filter-button";
import type { FilterSubject } from "./filter-subject";

type ActiveFiltersBarProps = {
  subjects: FilterSubject[];
  onClear: () => void;
};

export function ActiveFiltersBar({ subjects, onClear }: ActiveFiltersBarProps) {
  const { t } = useTranslation();
  const active = subjects.filter((subject) => subject.selected.length > 0);
  if (active.length === 0) return null;

  return (
    <section
      aria-label={t("tasks:filterBar.label")}
      className="flex shrink-0 items-start gap-2 border-border/80 border-b px-2 py-2 sm:px-3"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {active.map((subject) => (
          <ActiveFilterChip key={subject.id} subject={subject} />
        ))}
        <AddFilterButton subjects={subjects} />
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={onClear}
        className="h-7 shrink-0"
      >
        {t("common:actions.clearAll")}
      </Button>
    </section>
  );
}
