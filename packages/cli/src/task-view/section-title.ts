import type { Ui } from "../render/ui.js";

export function sectionTitle(ui: Ui, title: string, meta?: string): string {
  const { theme } = ui;
  return `  ${theme.strong(title)}${meta ? ` ${theme.muted(meta)}` : ""}`;
}

export function failedSection(ui: Ui, title: string): string[] {
  return [sectionTitle(ui, title, "could not load"), ""];
}
