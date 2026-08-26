export const DEFAULT_PRIMARY_COLOR = "#0F766E";
export const DEFAULT_ACCENT_COLOR = "#14B8A6";
export const DEFAULT_BACKGROUND_COLOR = "#0C0C0C";
export const DEFAULT_FOREGROUND_COLOR = "#F5F5F5";
export const DEFAULT_CARD_COLOR = "#141414";
export const DEFAULT_MUTED_COLOR = "#1F1F1F";
export const DEFAULT_BORDER_COLOR = "#2A2A2A";
export const DEFAULT_SIDEBAR_BACKGROUND_COLOR = "#0F0F0F";
export const DEFAULT_SIDEBAR_FOREGROUND_COLOR = "#A3A3A3";

export type BrandPalette = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  mutedColor: string;
  borderColor: string;
  sidebarBackgroundColor: string;
  sidebarForegroundColor: string;
};

export type ColorPreset = BrandPalette & {
  id: string;
};

export const DEFAULT_PALETTE: BrandPalette = {
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  foregroundColor: DEFAULT_FOREGROUND_COLOR,
  cardColor: DEFAULT_CARD_COLOR,
  mutedColor: DEFAULT_MUTED_COLOR,
  borderColor: DEFAULT_BORDER_COLOR,
  sidebarBackgroundColor: DEFAULT_SIDEBAR_BACKGROUND_COLOR,
  sidebarForegroundColor: DEFAULT_SIDEBAR_FOREGROUND_COLOR,
};

/** Named presets for the instance color personalizer (i18n labels via id). */
export const COLOR_PRESETS: ColorPreset[] = [
  { id: "elsetasks", ...DEFAULT_PALETTE },
  {
    id: "ocean",
    primaryColor: "#0369A1",
    accentColor: "#0EA5E9",
    backgroundColor: "#0B1220",
    foregroundColor: "#F1F5F9",
    cardColor: "#111827",
    mutedColor: "#1E293B",
    borderColor: "#334155",
    sidebarBackgroundColor: "#0F172A",
    sidebarForegroundColor: "#94A3B8",
  },
  {
    id: "forest",
    primaryColor: "#166534",
    accentColor: "#4ADE80",
    backgroundColor: "#0A0F0C",
    foregroundColor: "#F0FDF4",
    cardColor: "#121A14",
    mutedColor: "#1A2E1F",
    borderColor: "#274433",
    sidebarBackgroundColor: "#0D1510",
    sidebarForegroundColor: "#86A891",
  },
  {
    id: "slate",
    primaryColor: "#334155",
    accentColor: "#94A3B8",
    backgroundColor: "#09090B",
    foregroundColor: "#FAFAFA",
    cardColor: "#18181B",
    mutedColor: "#27272A",
    borderColor: "#3F3F46",
    sidebarBackgroundColor: "#0C0C0E",
    sidebarForegroundColor: "#A1A1AA",
  },
  {
    id: "amber",
    primaryColor: "#B45309",
    accentColor: "#F59E0B",
    backgroundColor: "#0C0A09",
    foregroundColor: "#FAFAF9",
    cardColor: "#1C1917",
    mutedColor: "#292524",
    borderColor: "#44403C",
    sidebarBackgroundColor: "#0F0E0D",
    sidebarForegroundColor: "#A8A29E",
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

export function contrastingForeground(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#171717" : "#FAFAFA";
}

export type PaletteInput = {
  [K in keyof BrandPalette]?: string | null;
};

export function resolvePalette(
  partial: PaletteInput | null | undefined,
): BrandPalette {
  return {
    primaryColor: partial?.primaryColor || DEFAULT_PRIMARY_COLOR,
    accentColor: partial?.accentColor || DEFAULT_ACCENT_COLOR,
    backgroundColor: partial?.backgroundColor || DEFAULT_BACKGROUND_COLOR,
    foregroundColor: partial?.foregroundColor || DEFAULT_FOREGROUND_COLOR,
    cardColor: partial?.cardColor || DEFAULT_CARD_COLOR,
    mutedColor: partial?.mutedColor || DEFAULT_MUTED_COLOR,
    borderColor: partial?.borderColor || DEFAULT_BORDER_COLOR,
    sidebarBackgroundColor:
      partial?.sidebarBackgroundColor || DEFAULT_SIDEBAR_BACKGROUND_COLOR,
    sidebarForegroundColor:
      partial?.sidebarForegroundColor || DEFAULT_SIDEBAR_FOREGROUND_COLOR,
  };
}

export function palettesEqual(a: BrandPalette, b: BrandPalette): boolean {
  return (Object.keys(DEFAULT_PALETTE) as (keyof BrandPalette)[]).every(
    (key) => a[key].toUpperCase() === b[key].toUpperCase(),
  );
}
