import { type Cell, text } from "../../render/cell.js";
import { type Column, renderTable } from "../../render/table.js";
import type { Ui } from "../../render/ui.js";
import type { ProfileJson } from "./profile-config.js";

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function renderProfileList(
  ui: Ui,
  profiles: ReadonlyArray<ProfileJson>,
): string[] {
  const { theme, glyphs } = ui;
  if (profiles.length === 0) {
    return [
      "",
      `  ${theme.muted("No stored logins yet. Run kaneo login to add one.")}`,
      "",
    ];
  }
  const columns: Array<Column<ProfileJson>> = [
    {
      header: "",
      cell: (profile): Cell =>
        profile.active ? [text(glyphs.dot, theme.success)] : [],
    },
    {
      header: "Profile",
      cell: (profile) => [
        text(profile.name, profile.active ? theme.strong : undefined),
      ],
    },
    {
      header: "Server",
      optional: true,
      cell: (profile) => [text(host(profile.apiUrl), theme.muted)],
    },
    {
      header: "User",
      flex: true,
      minWidth: 12,
      cell: (profile): Cell => {
        if (!profile.signedIn) return [text("signed out", theme.muted)];
        if (!profile.user) return [text("signed in")];
        return [
          text(profile.user.name),
          text(` ${glyphs.separator} ${profile.user.email}`, theme.muted),
        ];
      },
    },
  ];
  return [
    "",
    ...renderTable(ui, profiles, columns, {
      width: ui.caps.columns,
      indent: 2,
    }),
    "",
  ];
}
