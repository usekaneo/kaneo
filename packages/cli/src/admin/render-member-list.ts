import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import { formatDue } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import type { MemberJson } from "./member-json.js";
import { roleLabel } from "./roles.js";

export function formatDay(iso: string | null, now: Date): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : formatDue(date, now);
}

export function renderMemberList(
  ui: Ui,
  view: { readonly members: ReadonlyArray<MemberJson>; readonly now: Date },
): string[] {
  const { theme } = ui;
  if (view.members.length === 0) {
    return ["", `  ${theme.muted("This workspace has no members.")}`, ""];
  }
  return [
    "",
    ...renderTable(
      ui,
      view.members,
      [
        {
          header: "Name",
          flex: true,
          minWidth: 12,
          cell: (member): Cell => [text(member.name, theme.strong)],
        },
        {
          header: "Email",
          flex: true,
          minWidth: 16,
          cell: (member): Cell => [text(member.email, theme.muted)],
        },
        {
          header: "Role",
          cell: (member): Cell => [text(roleLabel(member.role))],
        },
        {
          header: "Joined",
          optional: true,
          cell: (member): Cell => [
            text(formatDay(member.joinedAt, view.now), theme.muted),
          ],
        },
      ],
      { width: ui.caps.columns, indent: 2 },
    ),
    "",
  ];
}
