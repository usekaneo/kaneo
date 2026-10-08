import type { Ui } from "../render/ui.js";
import { roleLabel } from "./roles.js";

export function renderMemberRemoved(
  ui: Ui,
  member: { readonly name: string; readonly email: string },
): string[] {
  const { theme, glyphs } = ui;
  return [
    "",
    `  ${theme.success(glyphs.tick)} Removed ${theme.strong(member.name)} ${theme.muted(`${glyphs.separator} ${member.email}`)}`,
    "",
  ];
}

export function renderMemberRole(
  ui: Ui,
  change: {
    readonly name: string;
    readonly role: string;
    readonly previousRole: string;
  },
): string[] {
  const { theme, glyphs } = ui;
  const line =
    change.role === change.previousRole
      ? `${theme.strong(change.name)} is already ${roleLabel(change.role)}`
      : `${theme.strong(change.name)} is now ${theme.strong(roleLabel(change.role))} ${theme.muted(`${glyphs.separator} was ${roleLabel(change.previousRole)}`)}`;
  return ["", `  ${theme.success(glyphs.tick)} ${line}`, ""];
}
