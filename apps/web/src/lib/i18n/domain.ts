import i18n from "i18next";

export function getStatusLabel(status: string) {
  return i18n.t(`tasks:status.${status}`, {
    defaultValue: toDisplayCase(status),
  });
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
