import { useState } from "react";
import { useTranslation } from "react-i18next";
import { subjectFilterEntries } from "./filter-entries";
import { FilterListbox } from "./filter-listbox";
import type { FilterSubject } from "./filter-subject";

type FilterSubjectPanelProps = {
  subject: FilterSubject;
  onBack?: () => void;
};

export function FilterSubjectPanel({
  subject,
  onBack,
}: FilterSubjectPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  return (
    <div className="-mx-1 -my-0.5">
      <FilterListbox
        placeholder={t("tasks:filterMenu.searchSubject", {
          name: subject.label,
        })}
        groups={subjectFilterEntries(subject, query, (count) =>
          t("tasks:toolbar.taskCount", { count }),
        )}
        query={query}
        onQueryChange={setQuery}
        emptyLabel={
          subject.options.length === 0
            ? subject.emptyLabel
            : t("tasks:filterMenu.noResults")
        }
        onEntrySelect={(entry) => entry.toggle?.()}
        onInputKeyDown={(event) => {
          if (
            onBack &&
            query === "" &&
            (event.key === "ArrowLeft" || event.key === "Backspace")
          ) {
            event.preventDefault();
            onBack();
          }
        }}
      />
    </div>
  );
}
