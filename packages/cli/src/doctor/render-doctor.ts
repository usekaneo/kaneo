import type { Ui } from "../render/ui.js";
import { truncate } from "../render/width.js";
import { CHECK_LABELS, type DoctorCheck } from "./doctor-check.js";

const MISSING_SHOWN = 8;

const LABEL_WIDTH = Math.max(
  ...Object.values(CHECK_LABELS).map((label) => label.length),
);

export function renderDoctor(
  ui: Ui,
  result: { readonly checks: ReadonlyArray<DoctorCheck> },
): string[] {
  const { theme, glyphs } = ui;
  const detailWidth = Math.max(16, ui.caps.columns - LABEL_WIDTH - 7);
  const lines = [""];
  for (const check of result.checks) {
    const mark = check.ok
      ? theme.success(glyphs.tick)
      : theme.danger(glyphs.cross);
    lines.push(
      `  ${mark} ${CHECK_LABELS[check.name].padEnd(LABEL_WIDTH)}  ${truncate(check.detail, detailWidth, glyphs.ellipsis)}`,
    );
    const missing = check.missing ?? [];
    const items =
      missing.length > MISSING_SHOWN
        ? [
            ...missing.slice(0, MISSING_SHOWN - 1),
            `and ${missing.length - MISSING_SHOWN + 1} more`,
          ]
        : missing;
    for (const item of items) {
      lines.push(
        `    ${" ".repeat(LABEL_WIDTH)}  ${theme.muted(truncate(item, detailWidth, glyphs.ellipsis))}`,
      );
    }
  }
  const failed = result.checks.filter((check) => !check.ok).length;
  lines.push(
    "",
    failed === 0
      ? `  ${theme.success(glyphs.tick)} ${theme.strong("Everything looks good")}`
      : `  ${theme.danger(glyphs.cross)} ${theme.strong(`${failed} of ${result.checks.length} checks failed`)}`,
    "",
  );
  return lines;
}
