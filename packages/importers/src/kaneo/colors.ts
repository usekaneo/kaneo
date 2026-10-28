const NAMED_COLORS: Record<string, string> = {
  gray: "#78716c",
  "dark-gray": "#64748b",
  purple: "#8b5cf6",
  teal: "#059669",
  green: "#16a34a",
  yellow: "#d97706",
  orange: "#ea580c",
  pink: "#e11d48",
  red: "#dc2626",
};

const FALLBACK_COLOR = "#6b7280";

export function kaneoColorToHex(color: string | null | undefined): string {
  const value = color?.trim().toLowerCase();
  if (!value) return FALLBACK_COLOR;

  const named = NAMED_COLORS[value];
  if (named) return named;

  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.exec(value)?.[1];
  if (!hex) return FALLBACK_COLOR;
  if (hex.length >= 6) return `#${hex.slice(0, 6)}`;
  return `#${[...hex.slice(0, 3)].map((digit) => digit + digit).join("")}`;
}
