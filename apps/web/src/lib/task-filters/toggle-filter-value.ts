export function toggleFilterValue(
  values: string[] | null | undefined,
  value: string,
): string[] | null {
  const current = values ?? [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return next.length > 0 ? next : null;
}
