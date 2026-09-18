export const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Bengali", Helvetica, Arial, sans-serif';

// Email clients ignore CSS variables and dark-mode media queries unevenly,
// so the palette is fixed and light.
export const palette = {
  page: "#f4f5f7",
  text: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e5e7eb",
  soft: "#f8fafc",
  accent: "#4f46e5",
  success: "#059669",
  warning: "#d97706",
  danger: "#dc2626",
  info: "#0284c7",
};

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const toneColor: Record<Tone, string> = {
  neutral: palette.muted,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
};
