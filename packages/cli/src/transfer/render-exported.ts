import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";

export type Exported = {
  readonly file: string;
  readonly tasks: number;
  readonly project: {
    readonly name: string;
    readonly key: string;
    readonly url: string;
  };
};

export function renderExported(ui: Ui, exported: Exported): string[] {
  const { theme, glyphs } = ui;
  const count = exported.tasks === 1 ? "1 task" : `${exported.tasks} tasks`;
  const project = renderCell(
    [text(exported.project.name, theme.strong, exported.project.url)],
    ui,
  );
  return [
    "",
    `  ${theme.success(glyphs.tick)} Exported ${count} from ${project} ${theme.muted(glyphs.separator)} ${exported.project.key} ${theme.muted(glyphs.arrow)} ${exported.file}`,
    "",
  ];
}
