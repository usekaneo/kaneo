import type { TaskLabelJson } from "../labels/label-json.js";
import { type Cell, cellWidth, fitCell, text } from "../render/cell.js";
import { labelChipSegment } from "../render/label-chip.js";
import type { Ui } from "../render/ui.js";
import { stringWidth } from "../render/width.js";

const GAP = "  ";

export function labelChips(
  ui: Ui,
  labels: ReadonlyArray<TaskLabelJson>,
  width: number,
): Cell {
  const chips = labels.map((label) => [
    labelChipSegment(ui, label.color),
    text(` ${label.name}`),
  ]);
  const shown: Cell[] = [];
  let used = 0;
  for (const [index, chip] of chips.entries()) {
    const hidden = chips.length - index - 1;
    const more = hidden > 0 ? stringWidth(`${GAP}+${hidden}`) : 0;
    const next = (shown.length > 0 ? GAP.length : 0) + cellWidth(chip);
    if (used + next + more > width) break;
    shown.push(chip);
    used += next;
  }
  if (shown.length === 0) {
    return fitCell(chips[0] ?? [], width, ui.glyphs.ellipsis);
  }
  const hidden = chips.length - shown.length;
  return [
    ...shown.flatMap((chip, index) =>
      index > 0 ? [text(GAP), ...chip] : chip,
    ),
    ...(hidden > 0 ? [text(`${GAP}+${hidden}`, ui.theme.muted)] : []),
  ];
}
