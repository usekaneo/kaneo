import { type Cell, text } from "../../render/cell.js";
import { type Column, renderTable } from "../../render/table.js";
import type { Ui } from "../../render/ui.js";
import type { WorkspaceJson } from "./workspace-json.js";

function roleLabel(role: string | null): string {
  if (!role) return "";
  return role
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(", ");
}

export function renderWorkspaceList(
  ui: Ui,
  workspaces: ReadonlyArray<WorkspaceJson>,
): string[] {
  const { theme, glyphs } = ui;
  if (workspaces.length === 0) {
    return [
      "",
      `  ${theme.muted("You are not a member of any workspace yet.")}`,
      "",
    ];
  }
  const hasActive = workspaces.some((workspace) => workspace.active);
  const columns: Array<Column<WorkspaceJson>> = [
    ...(hasActive
      ? [
          {
            header: "",
            cell: (workspace: WorkspaceJson): Cell =>
              workspace.active ? [text(glyphs.dot, theme.success)] : [],
          },
        ]
      : []),
    {
      header: "Name",
      flex: true,
      minWidth: 12,
      cell: (workspace) => [
        text(workspace.name, workspace.active ? theme.strong : undefined),
      ],
    },
    {
      header: "Slug",
      optional: true,
      cell: (workspace) => [text(workspace.slug, theme.muted)],
    },
    ...(workspaces.some((workspace) => workspace.role)
      ? [
          {
            header: "Role",
            optional: true,
            cell: (workspace: WorkspaceJson): Cell => [
              text(roleLabel(workspace.role)),
            ],
          },
        ]
      : []),
    {
      header: "ID",
      optional: true,
      cell: (workspace) => [text(workspace.id, theme.muted)],
    },
  ];
  const lines = [
    "",
    ...renderTable(ui, workspaces, columns, {
      width: ui.caps.columns,
      indent: 2,
    }),
    "",
  ];
  if (!hasActive) {
    lines.push(
      `  ${theme.muted("No workspace selected. Run kaneo workspace use to choose one.")}`,
      "",
    );
  }
  return lines;
}
