export const TRELLO_LABEL_COLORS: Readonly<Record<string, string>> = {
  green: "#4bce97",
  yellow: "#f5cd47",
  orange: "#fea362",
  red: "#f87168",
  purple: "#9f8fef",
  blue: "#579dff",
  sky: "#6cc3e0",
  lime: "#94c748",
  pink: "#e774bb",
  black: "#8590a2",
  green_dark: "#1f845a",
  yellow_dark: "#946f00",
  orange_dark: "#c25100",
  red_dark: "#c9372c",
  purple_dark: "#6e5dc6",
  blue_dark: "#0c66e4",
  sky_dark: "#227d9b",
  lime_dark: "#5b7f24",
  pink_dark: "#ae4787",
  black_dark: "#626f86",
  green_light: "#baf3db",
  yellow_light: "#f8e6a0",
  orange_light: "#fedec8",
  red_light: "#ffd5d2",
  purple_light: "#dfd8fd",
  blue_light: "#cce0ff",
  sky_light: "#c6edfb",
  lime_light: "#d3f1a7",
  pink_light: "#fdd0ec",
  black_light: "#dcdfe4",
};

export const FALLBACK_LABEL_COLOR = "#6b7280";

export function trelloLabelColor(color: string | null | undefined): string {
  if (!color || !Object.hasOwn(TRELLO_LABEL_COLORS, color)) {
    return FALLBACK_LABEL_COLOR;
  }
  return TRELLO_LABEL_COLORS[color] ?? FALLBACK_LABEL_COLOR;
}

export function trelloColorName(
  color: string | null | undefined,
): string | undefined {
  const words = color?.trim().replace(/_/g, " ");
  if (!words) return undefined;
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
