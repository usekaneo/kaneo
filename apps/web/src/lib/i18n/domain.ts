import i18n from "i18next";
import { DEFAULT_COLUMNS } from "@/constants/columns";

export function getStatusLabel(status: string) {
  return i18n.t(`tasks:status.${status}`, {
    defaultValue: toDisplayCase(status),
  });
}

export function getStatusDisplayLabel(status: string, columnName?: string) {
  const defaultName = DEFAULT_COLUMNS.find(
    (column) => column.id === status,
  )?.name;

  if (columnName) {
    if (defaultName && columnName === defaultName) {
      return getStatusLabel(status);
    }

    return columnName;
  }

  return getStatusLabel(status);
}

export function getPriorityLabel(priority: string) {
  return i18n.t(`tasks:priority.${priority}`, {
    defaultValue: toDisplayCase(priority),
  });
}

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
