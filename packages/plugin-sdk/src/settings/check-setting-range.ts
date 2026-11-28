export function checkSettingRange(
  name: string,
  field: Record<string, unknown>,
): string[] {
  const { min, max, default: fallback } = field;
  const hasMin = typeof min === "number";
  const hasMax = typeof max === "number";
  if (hasMin && hasMax && min > max) {
    return [`${name} min is greater than max`];
  }
  if (typeof fallback !== "number") return [];
  if (hasMin && fallback < min) {
    return [`${name} default must be at least ${min}`];
  }
  if (hasMax && fallback > max) {
    return [`${name} default must be at most ${max}`];
  }
  return [];
}
