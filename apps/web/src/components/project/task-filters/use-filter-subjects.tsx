import { CalendarDays, CircleDot, Tag, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getColumnIcon } from "@/lib/column";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { countValues } from "@/lib/task-filters/count-values";
import { DUE_DATE_OPTIONS } from "@/lib/task-filters/due-date-options";
import { customFieldSubjectId } from "@/lib/task-filters/filter-subject-id";
import {
  groupLabels,
  isLabelGroupSelected,
  labelGroupKey,
  toggleLabelGroup,
} from "@/lib/task-filters/label-groups";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { customFieldIcon } from "@/components/custom-fields/custom-field-icon";
import { formatCustomFieldValue } from "@/components/custom-fields/format-custom-field-value";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";
import type { FilterSubject, TaskFilterControls } from "./filter-subject";
import { LabelFilterDot } from "./label-filter-dot";
import { MemberFilterAvatar } from "./member-filter-avatar";
import { operatorLabels } from "./operator-labels";
import type { TaskFilterOptions } from "./use-task-filter-options";

const PRIORITIES = ["urgent", "high", "medium", "low"];

type UseFilterSubjectsInput = {
  controls: TaskFilterControls;
  options: TaskFilterOptions;
  columns?: ProjectWithTasks["columns"];
  tasks: Task[];
  showStatus: boolean;
};

export function useFilterSubjects({
  controls,
  options,
  columns = [],
  tasks,
  showStatus,
}: UseFilterSubjectsInput): FilterSubject[] {
  const { t } = useTranslation();
  const { filters, toggleFilter, updateFilter, setNegated } = controls;
  const empty = t("tasks:boardFilters.noValuesUsedYet");
  const negated = new Set(filters.negated ?? []);

  const subject = (
    id: string,
    fields: Pick<FilterSubject, "label" | "icon" | "options" | "selected"> &
      Partial<FilterSubject>,
    operatorKind: "is" | "include" = "is",
  ): FilterSubject => ({
    id,
    kind: "core",
    operators: operatorLabels(operatorKind, fields.selected.length, t),
    negated: negated.has(id),
    onNegate: (on) => setNegated(id, on),
    onToggle: () => undefined,
    onClear: () => undefined,
    emptyLabel: empty,
    ...fields,
  });

  const listSubject = (
    key: "status" | "priority" | "assignee" | "dueDate",
    fields: Pick<FilterSubject, "label" | "icon" | "options">,
  ) =>
    subject(key, {
      ...fields,
      selected: filters[key] ?? [],
      onToggle: (value) => toggleFilter(key, value),
      onClear: () => updateFilter(key, null),
    });

  const labelGroups = groupLabels(options.labels);
  const groupIdByLabel = new Map(
    labelGroups.map((group) => [labelGroupKey(group), group.id]),
  );
  const counts = {
    status: countValues(tasks, (task) => [task.status]),
    assignee: countValues(tasks, (task) => [task.userId]),
    priority: countValues(tasks, (task) => [task.priority]),
    labels: countValues(tasks, (task) =>
      (task.labels ?? []).map((label) =>
        groupIdByLabel.get(labelGroupKey(label)),
      ),
    ),
  };

  const core = [
    ...(showStatus
      ? [
          listSubject("status", {
            label: t("tasks:boardFilters.subjects.status"),
            icon: <CircleDot />,
            options: columns.map((column) => ({
              value: column.id,
              label: column.name,
              icon: getColumnIcon(column.id, column.isFinal, column.icon),
              count: counts.status[column.id],
            })),
          }),
        ]
      : []),
    listSubject("assignee", {
      label: t("tasks:boardFilters.subjects.assignee"),
      icon: <UserRound />,
      options: options.members.map((member) => ({
        value: member.userId,
        label: member.user?.name || t("common:people.unknown"),
        count: counts.assignee[member.userId],
        icon: (
          <MemberFilterAvatar
            name={member.user?.name}
            image={member.user?.image}
          />
        ),
      })),
    }),
    listSubject("priority", {
      label: t("tasks:boardFilters.subjects.priority"),
      icon: <PriorityGlyph priority="high" />,
      options: PRIORITIES.map((priority) => ({
        value: priority,
        label: getPriorityLabel(priority),
        icon: getPriorityIcon(priority),
        count: counts.priority[priority],
      })),
    }),
    subject(
      "labels",
      {
        label: t("tasks:boardFilters.subjects.labels"),
        icon: <Tag />,
        options: labelGroups.map((group) => ({
          value: group.id,
          label: group.name,
          icon: <LabelFilterDot color={group.color} />,
          count: counts.labels[group.id],
        })),
        selected: labelGroups
          .filter((group) =>
            isLabelGroupSelected(options.labels, group, filters.labels),
          )
          .map((group) => group.id),
        onToggle: (value) => {
          const group = labelGroups.find((item) => item.id === value);
          if (!group) return;
          updateFilter(
            "labels",
            toggleLabelGroup(options.labels, group, filters.labels),
          );
        },
        onClear: () => updateFilter("labels", null),
        emptyLabel: t("tasks:labels.empty"),
      },
      "include",
    ),
    listSubject("dueDate", {
      label: t("tasks:boardFilters.subjects.dueDate"),
      icon: <CalendarDays />,
      options: DUE_DATE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    }),
  ];

  const customFields = options.customFields.map((field) => {
    const Icon = customFieldIcon(field.type);
    const values =
      field.type === "dropdown"
        ? (field.options ?? [])
        : field.type === "boolean"
          ? ["true", "false"]
          : (options.usedCustomFieldValues[field.id] ?? []);
    return subject(customFieldSubjectId(field.id), {
      kind: "customField",
      label: field.name,
      icon: <Icon />,
      options: values.map((value) => ({
        value,
        label:
          field.type === "boolean"
            ? value === "true"
              ? "True"
              : "False"
            : field.type === "date"
              ? (formatCustomFieldValue("date", value, "medium")?.text ?? value)
              : value,
      })),
      selected: filters.customFields?.[field.id] ?? [],
      onToggle: (value) => controls.updateCustomFieldFilter(field.id, value),
      onClear: () => {
        const next = { ...filters.customFields };
        delete next[field.id];
        updateFilter(
          "customFields",
          Object.keys(next).length > 0 ? next : null,
        );
        setNegated(customFieldSubjectId(field.id), false);
      },
    });
  });

  return [...core, ...customFields];
}
