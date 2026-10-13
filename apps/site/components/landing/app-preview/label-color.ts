import labelColors from "@/constants/label-colors";

export function resolveLabelColor(value: string) {
  return (
    labelColors.find((color) => color.value === value)?.color ||
    value ||
    "var(--color-neutral-400)"
  );
}
