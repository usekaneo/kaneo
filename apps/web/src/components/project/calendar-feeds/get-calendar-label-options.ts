type LabelSource = {
  id: string;
  name: string;
  color: string;
  taskId: string | null;
};

export type CalendarLabelOption = {
  value: string;
  label: string;
  color: string;
};

export function getCalendarLabelOptions(
  labels: LabelSource[],
): CalendarLabelOption[] {
  const byName = new Map<string, LabelSource>();
  for (const label of labels) {
    if (!byName.has(label.name) || label.taskId === null) {
      byName.set(label.name, label);
    }
  }

  return [...byName.values()]
    .map((label) => ({
      value: label.id,
      label: label.name,
      color: label.color,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
