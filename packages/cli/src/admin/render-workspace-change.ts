import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";

export type WorkspaceJson = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
};

export type WorkspaceChange = {
  readonly verb: "Created" | "Updated" | "Deleted" | "Left";
  readonly workspace: WorkspaceJson;
  readonly changed?: ReadonlyArray<string>;
  readonly next?: string;
};

export function renderWorkspaceChange(
  ui: Ui,
  change: WorkspaceChange,
): string[] {
  const { theme, glyphs } = ui;
  const head = `  ${theme.success(glyphs.tick)} ${change.verb} `;
  const tail =
    change.verb === "Left"
      ? ""
      : ` ${theme.muted(`${glyphs.separator} ${change.workspace.slug}`)}`;
  const name = truncate(
    change.workspace.name,
    Math.max(ui.caps.columns - stringWidth(head) - stringWidth(tail), 8),
    glyphs.ellipsis,
  );
  const lines = ["", `${head}${theme.strong(name)}${tail}`];
  if (change.changed) {
    lines.push(
      `    ${theme.muted(
        change.changed.length > 0
          ? `Changed ${change.changed.join(", ")}`
          : "Already up to date",
      )}`,
    );
  }
  lines.push("");
  if (change.next) {
    lines.push(`  ${theme.muted(change.next)}`, "");
  }
  return lines;
}
