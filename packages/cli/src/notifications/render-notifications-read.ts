import type { Ui } from "../render/ui.js";

export function renderNotificationsRead(
  ui: Ui,
  result: { readonly all: boolean; readonly count: number },
): string[] {
  const { theme, glyphs } = ui;
  const what = result.all
    ? "all notifications"
    : `${result.count} ${result.count === 1 ? "notification" : "notifications"}`;
  return ["", `  ${theme.success(glyphs.tick)} Marked ${what} read`, ""];
}
