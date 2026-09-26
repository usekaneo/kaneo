// Hidden selections remain valid on existing tasks, but must not seed new tasks.
export function withoutHiddenOptions(
  value: string,
  type: string,
  hiddenOptions: string[],
): string {
  if (!hiddenOptions.length || !value.trim()) return value;
  if (type === "dropdown")
    return hiddenOptions.includes(value) || hiddenOptions.includes(value.trim())
      ? ""
      : value;
  if (type !== "multiselect") return value;
  try {
    const selected: unknown = JSON.parse(value);
    if (!Array.isArray(selected)) return value;
    const visible = selected.filter(
      (option) => !hiddenOptions.includes(option),
    );
    return visible.length ? JSON.stringify(visible) : "";
  } catch {
    // Preserve malformed values for the normal validator to reject.
    return value;
  }
}
