import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";

export type ProjectChange = {
  readonly verb: string;
  readonly name: string;
  readonly key: string;
  readonly url: string;
  readonly detail?: string | undefined;
  readonly target?: string | undefined;
};

export function renderProjectChange(ui: Ui, change: ProjectChange): string[] {
  const { theme, glyphs } = ui;
  const head = `  ${glyphs.tick} ${change.verb} project `;
  const tail = [
    ` ${glyphs.separator} ${change.key}`,
    change.target ? ` ${glyphs.arrow} ${change.target}` : "",
    change.detail ? ` ${glyphs.separator} ${change.detail}` : "",
  ].join("");
  const room = Math.max(8, ui.caps.columns - stringWidth(head + tail));
  const name = renderCell(
    [
      text(
        truncate(change.name, room, glyphs.ellipsis),
        theme.strong,
        change.url,
      ),
    ],
    ui,
  );
  const line = [
    `  ${theme.success(glyphs.tick)} ${change.verb} project ${name}`,
    ` ${theme.muted(glyphs.separator)} ${change.key}`,
    change.target
      ? ` ${theme.muted(glyphs.arrow)} ${theme.strong(change.target)}`
      : "",
    change.detail ? ` ${theme.muted(glyphs.separator)} ${change.detail}` : "",
  ].join("");
  return ["", line, ""];
}

export function renderProjectUnchanged(
  ui: Ui,
  project: {
    readonly name: string;
    readonly key: string;
    readonly url: string;
    readonly state: string;
  },
): string[] {
  const { theme, glyphs } = ui;
  const name = renderCell([text(project.name, theme.strong, project.url)], ui);
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${name} ${theme.muted(glyphs.separator)} ${project.key} ${theme.muted(`is already ${project.state}`)}`,
    "",
  ];
}
