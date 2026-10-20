import { resolveLabelColor } from "@/lib/label-color";

export function LabelFilterDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: resolveLabelColor(color) }}
    />
  );
}
