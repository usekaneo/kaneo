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
