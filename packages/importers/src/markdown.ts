export type ChecklistItem = {
  name: string;
  done: boolean;
};

export function checklistSection(
  title: string,
  items: ChecklistItem[],
): string {
  const lines = items.map(
    (item) => `- [${item.done ? "x" : " "}] ${item.name}`,
  );
  const heading = title.trim();
  return heading ? `## ${heading}\n\n${lines.join("\n")}` : lines.join("\n");
}

export function joinSections(
  sections: Array<string | null | undefined>,
): string {
  return sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}

export function toIsoDate(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
