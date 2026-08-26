export const DEFAULT_PRIMARY_COLOR = "#0F766E";
export const DEFAULT_ACCENT_COLOR = "#14B8A6";

export const DEFAULT_DARK_BACKGROUND_COLOR = "#0C0C0C";
export const DEFAULT_DARK_FOREGROUND_COLOR = "#F5F5F5";
export const DEFAULT_DARK_CARD_COLOR = "#141414";
export const DEFAULT_DARK_MUTED_COLOR = "#1F1F1F";
export const DEFAULT_DARK_BORDER_COLOR = "#2A2A2A";
export const DEFAULT_DARK_SIDEBAR_BACKGROUND_COLOR = "#0F0F0F";
export const DEFAULT_DARK_SIDEBAR_FOREGROUND_COLOR = "#A3A3A3";

export const DEFAULT_LIGHT_BACKGROUND_COLOR = "#FFFFFF";
export const DEFAULT_LIGHT_FOREGROUND_COLOR = "#262626";
export const DEFAULT_LIGHT_CARD_COLOR = "#FFFFFF";
export const DEFAULT_LIGHT_MUTED_COLOR = "#F5F5F5";
export const DEFAULT_LIGHT_BORDER_COLOR = "#E5E5E5";
export const DEFAULT_LIGHT_SIDEBAR_BACKGROUND_COLOR = "#FAFAFA";
export const DEFAULT_LIGHT_SIDEBAR_FOREGROUND_COLOR = "#737373";

/** @deprecated Use DEFAULT_DARK_* constants */
export const DEFAULT_BACKGROUND_COLOR = DEFAULT_DARK_BACKGROUND_COLOR;
/** @deprecated Use DEFAULT_DARK_* constants */
export const DEFAULT_FOREGROUND_COLOR = DEFAULT_DARK_FOREGROUND_COLOR;
/** @deprecated Use DEFAULT_DARK_* constants */
export const DEFAULT_CARD_COLOR = DEFAULT_DARK_CARD_COLOR;
/** @deprecated Use DEFAULT_DARK_* constants */
export const DEFAULT_MUTED_COLOR = DEFAULT_DARK_MUTED_COLOR;
/** @deprecated Use DEFAULT_DARK_* constants */
export const DEFAULT_BORDER_COLOR = DEFAULT_DARK_BORDER_COLOR;
/** @deprecated Use DEFAULT_DARK_* constants */
export const DEFAULT_SIDEBAR_BACKGROUND_COLOR =
  DEFAULT_DARK_SIDEBAR_BACKGROUND_COLOR;
/** @deprecated Use DEFAULT_DARK_* constants */
export const DEFAULT_SIDEBAR_FOREGROUND_COLOR =
  DEFAULT_DARK_SIDEBAR_FOREGROUND_COLOR;

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

export type ThemePalettes = {
  light: BrandPalette;
  dark: BrandPalette;
};

export type ColorPreset = ThemePalettes & {
  id: string;
};

export const DEFAULT_DARK_PALETTE: BrandPalette = {
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
  backgroundColor: DEFAULT_DARK_BACKGROUND_COLOR,
  foregroundColor: DEFAULT_DARK_FOREGROUND_COLOR,
  cardColor: DEFAULT_DARK_CARD_COLOR,
  mutedColor: DEFAULT_DARK_MUTED_COLOR,
  borderColor: DEFAULT_DARK_BORDER_COLOR,
  sidebarBackgroundColor: DEFAULT_DARK_SIDEBAR_BACKGROUND_COLOR,
  sidebarForegroundColor: DEFAULT_DARK_SIDEBAR_FOREGROUND_COLOR,
};

/** @deprecated Use DEFAULT_DARK_PALETTE */
export const DEFAULT_PALETTE = DEFAULT_DARK_PALETTE;

export const DEFAULT_LIGHT_PALETTE: BrandPalette = {
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
  backgroundColor: DEFAULT_LIGHT_BACKGROUND_COLOR,
  foregroundColor: DEFAULT_LIGHT_FOREGROUND_COLOR,
  cardColor: DEFAULT_LIGHT_CARD_COLOR,
  mutedColor: DEFAULT_LIGHT_MUTED_COLOR,
  borderColor: DEFAULT_LIGHT_BORDER_COLOR,
  sidebarBackgroundColor: DEFAULT_LIGHT_SIDEBAR_BACKGROUND_COLOR,
  sidebarForegroundColor: DEFAULT_LIGHT_SIDEBAR_FOREGROUND_COLOR,
};

export const DEFAULT_THEME_PALETTES: ThemePalettes = {
  light: DEFAULT_LIGHT_PALETTE,
  dark: DEFAULT_DARK_PALETTE,
};

/** Named presets for the instance color personalizer (i18n labels via id). */
export const COLOR_PRESETS: ColorPreset[] = [
  { id: "elsetasks", ...DEFAULT_THEME_PALETTES },
  {
    id: "ocean",
    light: {
      primaryColor: "#0369A1",
      accentColor: "#0EA5E9",
      backgroundColor: "#F8FAFC",
      foregroundColor: "#0F172A",
      cardColor: "#FFFFFF",
      mutedColor: "#F1F5F9",
      borderColor: "#E2E8F0",
      sidebarBackgroundColor: "#F1F5F9",
      sidebarForegroundColor: "#64748B",
    },
    dark: {
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
  },
  {
    id: "forest",
    light: {
      primaryColor: "#166534",
      accentColor: "#16A34A",
      backgroundColor: "#F7FDF9",
      foregroundColor: "#14532D",
      cardColor: "#FFFFFF",
      mutedColor: "#ECFDF3",
      borderColor: "#BBF7D0",
      sidebarBackgroundColor: "#F0FDF4",
      sidebarForegroundColor: "#4B7A57",
    },
    dark: {
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
  },
  {
    id: "slate",
    light: {
      primaryColor: "#334155",
      accentColor: "#64748B",
      backgroundColor: "#FFFFFF",
      foregroundColor: "#18181B",
      cardColor: "#FFFFFF",
      mutedColor: "#F4F4F5",
      borderColor: "#E4E4E7",
      sidebarBackgroundColor: "#FAFAFA",
      sidebarForegroundColor: "#71717A",
    },
    dark: {
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
  },
  {
    id: "amber",
    light: {
      primaryColor: "#B45309",
      accentColor: "#D97706",
      backgroundColor: "#FFFBEB",
      foregroundColor: "#292524",
      cardColor: "#FFFFFF",
      mutedColor: "#FEF3C7",
      borderColor: "#FDE68A",
      sidebarBackgroundColor: "#FFF7ED",
      sidebarForegroundColor: "#78716C",
    },
    dark: {
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

export function resolveDarkPalette(
  partial: PaletteInput | null | undefined,
): BrandPalette {
  return {
    primaryColor: partial?.primaryColor || DEFAULT_PRIMARY_COLOR,
    accentColor: partial?.accentColor || DEFAULT_ACCENT_COLOR,
    backgroundColor: partial?.backgroundColor || DEFAULT_DARK_BACKGROUND_COLOR,
    foregroundColor: partial?.foregroundColor || DEFAULT_DARK_FOREGROUND_COLOR,
    cardColor: partial?.cardColor || DEFAULT_DARK_CARD_COLOR,
    mutedColor: partial?.mutedColor || DEFAULT_DARK_MUTED_COLOR,
    borderColor: partial?.borderColor || DEFAULT_DARK_BORDER_COLOR,
    sidebarBackgroundColor:
      partial?.sidebarBackgroundColor || DEFAULT_DARK_SIDEBAR_BACKGROUND_COLOR,
    sidebarForegroundColor:
      partial?.sidebarForegroundColor || DEFAULT_DARK_SIDEBAR_FOREGROUND_COLOR,
  };
}

/** @deprecated Use resolveDarkPalette */
export function resolvePalette(
  partial: PaletteInput | null | undefined,
): BrandPalette {
  return resolveDarkPalette(partial);
}

export function deriveLightPalette(dark: BrandPalette): BrandPalette {
  return {
    primaryColor: dark.primaryColor,
    accentColor: dark.accentColor,
    backgroundColor: DEFAULT_LIGHT_BACKGROUND_COLOR,
    foregroundColor: DEFAULT_LIGHT_FOREGROUND_COLOR,
    cardColor: DEFAULT_LIGHT_CARD_COLOR,
    mutedColor: DEFAULT_LIGHT_MUTED_COLOR,
    borderColor: DEFAULT_LIGHT_BORDER_COLOR,
    sidebarBackgroundColor: DEFAULT_LIGHT_SIDEBAR_BACKGROUND_COLOR,
    sidebarForegroundColor: DEFAULT_LIGHT_SIDEBAR_FOREGROUND_COLOR,
  };
}

export function resolveLightPalette(
  partial: PaletteInput | null | undefined,
  dark?: BrandPalette,
): BrandPalette {
  const base = dark ? deriveLightPalette(dark) : DEFAULT_LIGHT_PALETTE;
  return {
    primaryColor: partial?.primaryColor || base.primaryColor,
    accentColor: partial?.accentColor || base.accentColor,
    backgroundColor: partial?.backgroundColor || base.backgroundColor,
    foregroundColor: partial?.foregroundColor || base.foregroundColor,
    cardColor: partial?.cardColor || base.cardColor,
    mutedColor: partial?.mutedColor || base.mutedColor,
    borderColor: partial?.borderColor || base.borderColor,
    sidebarBackgroundColor:
      partial?.sidebarBackgroundColor || base.sidebarBackgroundColor,
    sidebarForegroundColor:
      partial?.sidebarForegroundColor || base.sidebarForegroundColor,
  };
}

export function resolveThemePalettes(input: {
  dark?: PaletteInput | null;
  light?: PaletteInput | null;
}): ThemePalettes {
  const dark = resolveDarkPalette(input.dark);
  const light = resolveLightPalette(input.light, dark);
  return { light, dark };
}

export function palettesEqual(a: BrandPalette, b: BrandPalette): boolean {
  return (Object.keys(DEFAULT_DARK_PALETTE) as (keyof BrandPalette)[]).every(
    (key) => a[key].toUpperCase() === b[key].toUpperCase(),
  );
}

export function themePalettesEqual(
  a: ThemePalettes,
  b: ThemePalettes,
): boolean {
  return palettesEqual(a.light, b.light) && palettesEqual(a.dark, b.dark);
}

export function darkPaletteToCssBlock(palette: BrandPalette): string {
  const primaryFg = contrastingForeground(palette.primaryColor);
  return `
    --brand-primary: ${palette.primaryColor};
    --brand-accent: ${palette.accentColor};
    --primary: ${palette.primaryColor};
    --primary-foreground: ${primaryFg};
    --ring: ${palette.primaryColor};
    --sidebar-ring: ${palette.primaryColor};
    --sidebar-primary: ${palette.primaryColor};
    --sidebar-primary-foreground: ${primaryFg};
    --background: ${palette.backgroundColor};
    --foreground: ${palette.foregroundColor};
    --card: ${palette.cardColor};
    --card-foreground: ${palette.foregroundColor};
    --popover: ${palette.cardColor};
    --popover-foreground: ${palette.foregroundColor};
    --muted: ${palette.mutedColor};
    --muted-foreground: ${palette.sidebarForegroundColor};
    --secondary: ${palette.mutedColor};
    --secondary-foreground: ${palette.foregroundColor};
    --accent: ${palette.mutedColor};
    --accent-foreground: ${palette.foregroundColor};
    --border: ${palette.borderColor};
    --input: ${palette.borderColor};
    --sidebar: ${palette.sidebarBackgroundColor};
    --sidebar-foreground: ${palette.sidebarForegroundColor};
    --sidebar-border: ${palette.borderColor};
    --sidebar-accent: ${palette.mutedColor};
    --sidebar-accent-foreground: ${palette.foregroundColor};
  `.trim();
}

export const BRANDING_STYLE_ID = "elsetasks-branding-vars";

export function applyThemePaletteStyles(palettes: ThemePalettes): void {
  let style = document.getElementById(
    BRANDING_STYLE_ID,
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = BRANDING_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = `
html:not(.dark) {
${darkPaletteToCssBlock(palettes.light)}
}
html.dark {
${darkPaletteToCssBlock(palettes.dark)}
}
`.trim();
}

export function clearThemePaletteStyles(): void {
  document.getElementById(BRANDING_STYLE_ID)?.remove();
}
