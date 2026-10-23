import type { PinnedLabel } from "@/fetchers/label/get-pinned-labels";

export type PinnedLabelGroup = {
  name: string;
  color: string;
  pins: PinnedLabel[];
};

// The board filters labels by name across workspaces, so pins of the same name
// from several workspaces are one shortcut.
export function groupPinnedLabels(pins: PinnedLabel[]): PinnedLabelGroup[] {
  const groups = new Map<string, PinnedLabelGroup>();
  for (const pin of pins) {
    const key = pin.name.toLowerCase();
    const group = groups.get(key);
    if (group) group.pins.push(pin);
    else groups.set(key, { name: pin.name, color: pin.color, pins: [pin] });
  }
  return [...groups.values()];
}
