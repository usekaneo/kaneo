import type { ReactNode } from "react";
import type { FilterSubject } from "./filter-subject";

export type FilterEntry = {
  value: string;
  label: string;
  icon?: ReactNode;
  meta?: string;
  badge?: number;
  checked?: boolean;
  opensSubject?: string;
  toggle?: () => void;
};

export type FilterEntryGroup = {
  value: string;
  label?: string;
  items: FilterEntry[];
};

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.trim().toLowerCase());

const subjectEntry = (subject: FilterSubject): FilterEntry => ({
  value: `subject:${subject.id}`,
  label: subject.label,
  icon: subject.icon,
  badge: subject.selected.length,
  opensSubject: subject.id,
});

const optionEntries = (
  subject: FilterSubject,
  query: string,
  meta: (option: FilterSubject["options"][number]) => string | undefined,
) =>
  subject.options
    .filter((option) => matches(option.label, query))
    .map<FilterEntry>((option) => ({
      value: `${subject.id}:${option.value}`,
      label: option.label,
      icon: option.icon,
      meta: meta(option),
      checked: subject.selected.includes(option.value),
      toggle: () => subject.onToggle(option.value),
    }));

export function rootFilterEntries(
  subjects: FilterSubject[],
  query: string,
  customFieldsLabel: string,
): FilterEntryGroup[] {
  if (!query.trim()) {
    return [
      {
        value: "core",
        items: subjects
          .filter((subject) => subject.kind === "core")
          .map(subjectEntry),
      },
      {
        value: "customFields",
        label: customFieldsLabel,
        items: subjects
          .filter((subject) => subject.kind === "customField")
          .map(subjectEntry),
      },
    ].filter((group) => group.items.length > 0);
  }

  return [
    {
      value: "subjects",
      items: subjects
        .filter((subject) => matches(subject.label, query))
        .map(subjectEntry),
    },
    {
      value: "options",
      items: subjects.flatMap((subject) =>
        optionEntries(subject, query, () => subject.label),
      ),
    },
  ].filter((group) => group.items.length > 0);
}

export function subjectFilterEntries(
  subject: FilterSubject,
  query: string,
  formatCount: (count: number) => string,
): FilterEntryGroup[] {
  const items = optionEntries(subject, query, (option) =>
    option.count ? formatCount(option.count) : undefined,
  );
  return items.length > 0 ? [{ value: subject.id, items }] : [];
}
