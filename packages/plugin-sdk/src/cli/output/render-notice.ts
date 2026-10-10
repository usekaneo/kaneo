import type { Theme } from "./theme.js";

export function renderWarning(theme: Theme, message: string): string {
  return theme.warning(`warning: ${message}`);
}

export function renderError(theme: Theme, message: string): string {
  return theme.danger(`error: ${message}`);
}
