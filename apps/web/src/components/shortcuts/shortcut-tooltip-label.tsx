import type { ReactNode } from "react";
import type { ShortcutId } from "@/lib/shortcuts/catalog";
import { ShortcutKeys } from "./shortcut-keys";

type ShortcutTooltipLabelProps = {
  label: ReactNode;
  shortcutId?: ShortcutId;
};

export function ShortcutTooltipLabel({
  label,
  shortcutId,
}: ShortcutTooltipLabelProps) {
  return (
    <span className="flex items-center gap-2">
      {label}
      {shortcutId && <ShortcutKeys id={shortcutId} tone="tooltip" />}
    </span>
  );
}
