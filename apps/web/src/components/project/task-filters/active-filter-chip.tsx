import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "./filter-subject";
import { FilterOperatorMenu } from "./filter-operator-menu";
import { FilterValueButton } from "./filter-value-button";

export function ActiveFilterChip({ subject }: { subject: FilterSubject }) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex h-7 max-w-full origin-left items-stretch overflow-hidden rounded-md border border-border bg-background text-xs shadow-xs/5 transition-[opacity,scale] duration-150 ease-out *:border-border *:not-last:border-r starting:scale-95 starting:opacity-0 motion-reduce:starting:scale-100 dark:bg-input/32">
      <span className="flex shrink-0 items-center gap-1.5 px-2 text-muted-foreground [&>svg]:size-3.5">
        {subject.icon}
        {subject.label}
      </span>
      <FilterOperatorMenu subject={subject} />
      <FilterValueButton subject={subject} />
      <button
        type="button"
        onClick={subject.onClear}
        aria-label={t("tasks:filterBar.removeFilter", { name: subject.label })}
        className="inline-flex w-7 shrink-0 items-center justify-center text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
