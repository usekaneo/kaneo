import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GlobalBoardMeta } from "@/fetchers/task/get-global-board-meta";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getPriorityLabel } from "@/lib/i18n/domain";
import type { GlobalBoardFilters } from "./global-board-filters";

const ANY = "__any__";
const PRIORITIES = ["urgent", "high", "medium", "low", "no-priority"] as const;

type GlobalBoardToolbarProps = {
  meta: GlobalBoardMeta | undefined;
  filters: GlobalBoardFilters;
  onChange: (filters: GlobalBoardFilters) => void;
};

type Option = { value: string; label: string };

function FilterSelect({
  label,
  value,
  anyLabel,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  anyLabel: string;
  options: Option[];
  onChange: (value: string | undefined) => void;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) =>
        onChange(typeof next === "string" && next !== ANY ? next : undefined)
      }
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        className="w-auto max-w-48 shrink-0"
      >
        <SelectValue>{selected ? selected.label : anyLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function GlobalBoardToolbar({
  meta,
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

  const set = (key: keyof GlobalBoardFilters) => (value: string | undefined) =>
    onChange({ ...filters, [key]: value });

  const projects = (meta?.projects ?? []).filter(
    (project) =>
      !filters.workspaceId || project.workspaceId === filters.workspaceId,
  );
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-4 pt-3 pb-1 md:px-5 [scrollbar-width:none]">
      <div className="relative min-w-40 shrink-0 sm:w-56">
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
      <FilterSelect
        label={t("tasks:globalBoard.filters.workspace")}
        anyLabel={t("tasks:globalBoard.filters.allWorkspaces")}
        value={filters.workspaceId}
        options={(meta?.workspaces ?? []).map((workspace) => ({
          value: workspace.id,
          label: workspace.name,
        }))}
        onChange={(workspaceId) =>
          onChange({ ...filters, workspaceId, projectId: undefined })
        }
      />
      <FilterSelect
        label={t("tasks:globalBoard.filters.project")}
        anyLabel={t("tasks:globalBoard.filters.allProjects")}
        value={filters.projectId}
        options={projects.map((project) => ({
          value: project.id,
          label: project.name,
        }))}
        onChange={set("projectId")}
      />
      <FilterSelect
        label={t("tasks:globalBoard.filters.assignee")}
        anyLabel={t("tasks:globalBoard.filters.anyone")}
        value={filters.assigneeId}
        options={[
          { value: "me", label: t("tasks:globalBoard.filters.me") },
          {
            value: "unassigned",
            label: t("tasks:globalBoard.filters.unassigned"),
          },
          ...(meta?.assignees ?? []).map((user) => ({
            value: user.id,
            label: user.name,
          })),
        ]}
        onChange={set("assigneeId")}
      />
      <FilterSelect
        label={t("tasks:priority.label")}
        anyLabel={t("tasks:globalBoard.filters.anyPriority")}
        value={filters.priority}
        options={PRIORITIES.map((priority) => ({
          value: priority,
          label: getPriorityLabel(priority),
        }))}
        onChange={set("priority")}
      />
      <FilterSelect
        label={t("tasks:globalBoard.filters.label")}
        anyLabel={t("tasks:globalBoard.filters.anyLabel")}
        value={filters.label}
        options={(meta?.labels ?? []).map((label) => ({
          value: label.name,
          label: label.name,
        }))}
        onChange={set("label")}
      />
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setSearch("");
            onChange({});
          }}
        >
          <X aria-hidden="true" />
          {t("tasks:globalBoard.filters.clear")}
        </Button>
      )}
    </div>
  );
}
