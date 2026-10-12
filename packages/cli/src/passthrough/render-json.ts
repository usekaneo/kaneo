import type { Ui } from "../render/ui.js";

export function renderJson(_ui: Ui, value: unknown): string[] {
  return (JSON.stringify(value, null, 2) ?? "null").split("\n");
}
