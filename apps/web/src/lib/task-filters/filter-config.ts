import type { BoardFilters } from "@/lib/task-filters/types";

export const DEFAULT_FILTERS: Required<BoardFilters> = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  createdDate: null,
  labels: null,
  customFields: null,
  negated: null,
};

const FILTER_KEYS: Array<keyof BoardFilters> = [
  "status",
  "priority",
  "assignee",
  "dueDate",
  "createdDate",
  "labels",
  "customFields",
  "negated",
];

export function normalizeFilters(raw: unknown): Required<BoardFilters> {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_FILTERS };
  }

  const candidate = raw as Partial<Record<keyof BoardFilters, unknown>>;
  const normalized = { ...DEFAULT_FILTERS };

  for (const key of FILTER_KEYS) {
    if (key === "customFields") {
      const value = candidate.customFields;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const customFields = Object.fromEntries(
          Object.entries(value).filter(
            ([, values]) =>
              Array.isArray(values) &&
              values.length > 0 &&
              values.every((item) => typeof item === "string"),
          ),
        ) as Record<string, string[]>;

        normalized.customFields =
          Object.keys(customFields).length > 0 ? customFields : null;
      }

      continue;
    }
    const value = candidate[key];
    if (Array.isArray(value)) {
      const values = value.filter((v): v is string => typeof v === "string");
      normalized[key] = values.length > 0 ? values : null;
    }
  }

  return normalized;
}
