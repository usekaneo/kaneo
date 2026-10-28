import type { Ui } from "../../render/ui.js";

export type UsedWorkspace = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: string | null;
  readonly description: string | null;
};

export function renderWorkspaceUsed(
  ui: Ui,
  result: { readonly workspace: UsedWorkspace },
): string[] {
  const { theme, glyphs } = ui;
  return [
    "",
    `  ${theme.success(glyphs.tick)} Using ${theme.strong(result.workspace.name)}`,
    `    ${theme.muted(result.workspace.id)}`,
    "",
  ];
}
