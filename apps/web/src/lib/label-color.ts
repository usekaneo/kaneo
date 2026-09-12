import labelColors from "@/constants/label-colors";

const FALLBACK_LABEL_COLOR = "var(--color-neutral-400)";
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

export function resolveLabelColor(value: string): string {
  const mapped = labelColors.find((color) => color.value === value)?.color;
  if (mapped) return mapped;

  if (HEX_COLOR.test(value)) return value;

  if (typeof CSS !== "undefined" && CSS.supports?.("color", value)) {
    return value;
  }

  return FALLBACK_LABEL_COLOR;
}

export { FALLBACK_LABEL_COLOR };
