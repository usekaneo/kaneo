import type { Ui } from "../render/ui.js";

export type OpenTaskResult = {
  readonly url: string;
  readonly opened: boolean;
};

export function renderOpenTask(ui: Ui, result: OpenTaskResult): string[] {
  const { theme, glyphs } = ui;
  const verb = result.opened ? "Opened" : "Open";
  return [
    "",
    `  ${theme.muted(glyphs.arrow)} ${verb} ${theme.info(result.url)}`,
    "",
  ];
}
