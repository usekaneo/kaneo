import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { type FilterEntry, rootFilterEntries } from "./filter-entries";
import { FilterListbox } from "./filter-listbox";
import type { FilterSubject } from "./filter-subject";
import { FilterSubjectPanel } from "./filter-subject-panel";

const HOVER_DELAY_MS = 120;

export function FilterRootPanel({ subjects }: { subjects: FilterSubject[] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [nested, setNested] = useState<{
    subjectId: string;
    anchor: HTMLElement;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const nestedSubject = subjects.find(
    (subject) => subject.id === nested?.subjectId,
  );

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const openNested = (entry: FilterEntry, anchor: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    setNested(
      entry.opensSubject ? { subjectId: entry.opensSubject, anchor } : null,
    );
  };

  const closeNested = () => {
    setNested(null);
    inputRef.current?.focus();
  };

  return (
    <div className="-mx-1 -my-0.5">
      <FilterListbox
        placeholder={t("tasks:filterMenu.addFilter")}
        groups={rootFilterEntries(
          subjects,
          query,
          t("tasks:common.customFields"),
        )}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          setNested(null);
        }}
        emptyLabel={t("tasks:filterMenu.noResults")}
        activeValue={nested ? `subject:${nested.subjectId}` : null}
        inputRef={inputRef}
        onEntrySelect={(entry, element) => {
          if (entry.opensSubject) {
            openNested(entry, element);
          } else {
            entry.toggle?.();
          }
        }}
        onEntryHover={(entry, element) => {
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(
            () => openNested(entry, element),
            HOVER_DELAY_MS,
          );
        }}
        onInputKeyDown={(event, highlighted) => {
          if (event.key === "ArrowRight" && highlighted?.entry.opensSubject) {
            event.preventDefault();
            openNested(highlighted.entry, highlighted.element);
          }
        }}
      />
      <Popover
        open={!!nestedSubject}
        onOpenChange={(open) => {
          if (!open) closeNested();
        }}
      >
        <PopoverContent
          anchor={nested?.anchor}
          side="left"
          align="start"
          sideOffset={6}
          alignOffset={-5}
          finalFocus={inputRef}
          positionerClassName="transition-none"
          className="w-64"
        >
          {nestedSubject && (
            <FilterSubjectPanel
              key={nestedSubject.id}
              subject={nestedSubject}
              onBack={closeNested}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
