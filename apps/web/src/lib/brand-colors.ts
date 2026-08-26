export const DEFAULT_PRIMARY_COLOR = "#0F766E";
export const DEFAULT_ACCENT_COLOR = "#14B8A6";

export type ColorPreset = {
  id: string;
  primaryColor: string;
  accentColor: string;
};

/** Named presets for the instance color personalizer (i18n labels via id). */
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "elsetasks",
    primaryColor: DEFAULT_PRIMARY_COLOR,
    accentColor: DEFAULT_ACCENT_COLOR,
  },
  {
    id: "ocean",
    primaryColor: "#0369A1",
    accentColor: "#0EA5E9",
  },
  {
    id: "forest",
    primaryColor: "#166534",
    accentColor: "#4ADE80",
  },
  {
    id: "slate",
    primaryColor: "#334155",
    accentColor: "#94A3B8",
  },
  {
    id: "amber",
    primaryColor: "#B45309",
    accentColor: "#F59E0B",
  },
];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (HEX_COLOR_RE.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }
  return null;
}
