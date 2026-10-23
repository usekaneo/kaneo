import {
  Building2,
  CalendarDays,
  Folder,
  Tag,
  UserRound,
  UserRoundX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/components/project/task-filters/filter-subject";
import { LabelFilterDot } from "@/components/project/task-filters/label-filter-dot";
import { MemberFilterAvatar } from "@/components/project/task-filters/member-filter-avatar";
import { operatorLabels } from "@/components/project/task-filters/operator-labels";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";
import icons from "@/constants/project-icons";
import type { GlobalBoardMeta } from "@/fetchers/task/get-global-board-meta";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { DUE_DATE_OPTIONS } from "@/lib/task-filters/due-date-options";
import {
  type GlobalBoardFilterKey,
  type GlobalBoardFilters,
  hasLabel,
  setFilterNegated,
  setFilterValues,
  toggleFilterValue,
  toggleLabel,
} from "./global-board-filters";

const PRIORITIES = ["urgent", "high", "medium", "low", "no-priority"];

// The project board's filter subjects, over every workspace the board spans.
export function useGlobalBoardFilterSubjects(
  meta: GlobalBoardMeta,
  filters: GlobalBoardFilters,
  onChange: (filters: GlobalBoardFilters) => void,
): FilterSubject[] {
  const { t } = useTranslation();
  const negated = new Set(filters.negate ?? []);

  const subject = (
    key: GlobalBoardFilterKey,
    fields: Pick<FilterSubject, "label" | "icon" | "options"> &
      Partial<FilterSubject>,
    operatorKind: "is" | "include" = "is",
  ): FilterSubject => {
    const selected = fields.selected ?? filters[key] ?? [];
    return {
      id: key,
      kind: "core",
      operators: operatorLabels(operatorKind, selected.length, t),
      selected,
      negated: negated.has(key),
      onNegate: (on) => onChange(setFilterNegated(filters, key, on)),
      onToggle: (value) => onChange(toggleFilterValue(filters, key, value)),
      onClear: () => onChange(setFilterValues(filters, key, undefined)),
      emptyLabel: t("tasks:boardFilters.noValuesUsedYet"),
      ...fields,
    };
  };

  // With workspaces chosen, only their projects are offered.
  const workspaceIds = filters.workspaceId;
  const projects = meta.projects.filter(
    (project) =>
      !workspaceIds?.length ||
      negated.has("workspaceId") !== workspaceIds.includes(project.workspaceId),
  );
  const workspaceNames = new Map(
    meta.workspaces.map((workspace) => [workspace.id, workspace.name]),
  );
  const showWorkspaceNames = meta.workspaces.length > 1;

  return [
    ...(meta.workspaces.length > 1
      ? [
          subject("workspaceId", {
            label: t("tasks:globalBoard.filters.workspace"),
            icon: <Building2 />,
            options: meta.workspaces.map((workspace) => ({
              value: workspace.id,
              label: workspace.name,
            })),
          }),
        ]
      : []),
    subject("projectId", {
      label: t("tasks:globalBoard.filters.project"),
      icon: <Folder />,
      options: projects.map((project) => {
        const Icon = icons[project.icon as keyof typeof icons] ?? Folder;
        const workspace = workspaceNames.get(project.workspaceId);
        return {
          value: project.id,
          label:
            showWorkspaceNames && workspace
              ? `${project.name} · ${workspace}`
              : project.name,
          icon: <Icon />,
        };
      }),
    }),
    subject("assigneeId", {
      label: t("tasks:boardFilters.subjects.assignee"),
      icon: <UserRound />,
      options: [
        {
          value: "me",
          label: t("tasks:globalBoard.filters.me"),
          icon: <UserRound />,
        },
        {
          value: "unassigned",
          label: t("tasks:globalBoard.filters.unassigned"),
          icon: <UserRoundX />,
        },
        ...meta.assignees.map((user) => ({
          value: user.id,
          label: user.name || t("common:people.unknown"),
          icon: <MemberFilterAvatar name={user.name} image={user.image} />,
        })),
      ],
    }),
    subject("priority", {
      label: t("tasks:boardFilters.subjects.priority"),
      icon: <PriorityGlyph priority="high" />,
      options: PRIORITIES.map((priority) => ({
        value: priority,
        label: getPriorityLabel(priority),
        icon: getPriorityIcon(priority),
      })),
    }),
    subject(
      "label",
      {
        label: t("tasks:boardFilters.subjects.labels"),
        icon: <Tag />,
        options: meta.labels.map((label) => ({
          value: label.name,
          label: label.name,
          icon: <LabelFilterDot color={label.color} />,
        })),
        // A pinned link may spell a label differently from this list, or name
        // one beyond its limit.
        selected: (filters.label ?? []).map(
          (name) =>
            meta.labels.find((label) => hasLabel({ label: [name] }, label.name))
              ?.name ?? name,
        ),
        onToggle: (name) => onChange(toggleLabel(filters, name)),
        emptyLabel: t("tasks:labels.empty"),
      },
      "include",
    ),
    subject("dueDate", {
      label: t("tasks:boardFilters.subjects.dueDate"),
      icon: <CalendarDays />,
      options: DUE_DATE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    }),
  ];
}
