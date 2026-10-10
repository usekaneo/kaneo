import type { FieldJson } from "./field-json.js";

function compact(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function matchField(
  fields: ReadonlyArray<FieldJson>,
  reference: string,
): FieldJson | undefined {
  const trimmed = reference.trim();
  const wanted = trimmed.toLowerCase();
  const key = compact(trimmed);
  if (key === "") return undefined;
  const byName = fields.filter((field) => field.name.toLowerCase() === wanted);
  const byKey = fields.filter((field) => compact(field.name) === key);
  return (
    fields.find((field) => field.id === trimmed) ??
    (byName.length === 1 ? byName[0] : undefined) ??
    (byKey.length === 1 ? byKey[0] : undefined)
  );
}
