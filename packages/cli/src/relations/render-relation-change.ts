import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";
import {
  linkedPhrase,
  type RelationType,
  unlinkedPhrase,
} from "./relation-types.js";

export type TaskLabel = {
  readonly label: string;
  readonly url: string;
};

function reference(ui: Ui, task: TaskLabel): string {
  return renderCell([text(task.label, ui.theme.strong, task.url)], ui);
}

export function renderRelationLinked(
  ui: Ui,
  change: {
    readonly type: RelationType;
    readonly task: TaskLabel;
    readonly other: TaskLabel & { readonly title: string };
  },
): string[] {
  const { theme, glyphs } = ui;
  const head = `  ${theme.success(glyphs.tick)} ${reference(ui, change.task)} ${linkedPhrase(change.type)} ${reference(ui, change.other)} ${theme.muted(glyphs.separator)} `;
  const title = truncate(
    change.other.title,
    Math.max(ui.caps.columns - stringWidth(head), 8),
    glyphs.ellipsis,
  );
  return ["", `${head}${title}`, ""];
}

export function renderRelationsRemoved(
  ui: Ui,
  change: {
    readonly types: ReadonlyArray<string>;
    readonly task: TaskLabel;
    readonly other: TaskLabel;
  },
): string[] {
  const { theme, glyphs } = ui;
  const tick = theme.success(glyphs.tick);
  const task = reference(ui, change.task);
  const other = reference(ui, change.other);
  const [only] = change.types;
  const phrase =
    change.types.length === 1 && only ? unlinkedPhrase(only) : null;
  const line = phrase
    ? `  ${tick} ${task} ${phrase} ${other}`
    : change.types.length > 1
      ? `  ${tick} Removed ${change.types.length} relations between ${task} and ${other}`
      : `  ${tick} Unlinked ${task} and ${other}`;
  return ["", line, ""];
}
