export type ChoiceType = "dropdown" | "multiselect";

export function isChoiceType(type: string): type is ChoiceType {
  return type === "dropdown" || type === "multiselect";
}

export function readOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.filter(
    (option): option is string => typeof option === "string",
  );
}

export function normalizeOptions(options: string[]): string[] {
  return Array.from(
    new Set(options.map((option) => option.trim()).filter(Boolean)),
  );
}

export function parseChoiceValue(
  value: string | null,
  type: ChoiceType,
): string[] {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return [];
  if (type === "dropdown") return [trimmed];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function convertChoiceValue(
  value: string,
  from: ChoiceType,
  to: ChoiceType,
): string | undefined {
  if (from === to) return value;

  const picked = parseChoiceValue(value, from);
  if (to === "multiselect") {
    return picked.length > 0 ? JSON.stringify(picked) : "";
  }

  if (picked.length > 1) return undefined;
  return picked[0] ?? "";
}

export function findUsedOptions(
  values: Array<string | null>,
  type: ChoiceType,
  candidates: string[],
): string[] {
  const used = new Set(
    values.flatMap((value) => parseChoiceValue(value, type)),
  );
  return candidates.filter((option) => used.has(option));
}

// Hidden options are a subset of the field's options; stale entries drop out.
export function readHiddenOptions(hidden: unknown, options: string[]) {
  return readOptions(hidden).filter((option) => options.includes(option));
}

// Hidden options stay on tasks that already have them but can't be picked
// anew, so only options missing from the current value count.
export function findNewHiddenPicks(
  next: string | null,
  current: string | null,
  type: ChoiceType,
  hidden: string[],
): string[] {
  if (hidden.length === 0) return [];
  const kept = new Set(parseChoiceValue(current, type));
  return parseChoiceValue(next, type).filter(
    (option) => hidden.includes(option) && !kept.has(option),
  );
}
