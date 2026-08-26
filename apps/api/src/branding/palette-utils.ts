export type BrandPaletteDto = {
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

export type BrandingDto = BrandPaletteDto & {
  displayName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  paletteLight: BrandPaletteDto;
  setupCompleted: boolean;
};

const DEFAULT_DARK: BrandPaletteDto = {
  primaryColor: "#0F766E",
  accentColor: "#14B8A6",
  backgroundColor: "#0C0C0C",
  foregroundColor: "#F5F5F5",
  cardColor: "#141414",
  mutedColor: "#1F1F1F",
  borderColor: "#2A2A2A",
  sidebarBackgroundColor: "#0F0F0F",
  sidebarForegroundColor: "#A3A3A3",
};

const DEFAULT_LIGHT: BrandPaletteDto = {
  primaryColor: "#0F766E",
  accentColor: "#14B8A6",
  backgroundColor: "#FFFFFF",
  foregroundColor: "#262626",
  cardColor: "#FFFFFF",
  mutedColor: "#F5F5F5",
  borderColor: "#E5E5E5",
  sidebarBackgroundColor: "#FAFAFA",
  sidebarForegroundColor: "#737373",
};

const PALETTE_KEYS = Object.keys(DEFAULT_DARK) as (keyof BrandPaletteDto)[];

function resolvePalette(
  partial: Partial<BrandPaletteDto> | null | undefined,
  defaults: BrandPaletteDto,
): BrandPaletteDto {
  return {
    primaryColor: partial?.primaryColor ?? defaults.primaryColor,
    accentColor: partial?.accentColor ?? defaults.accentColor,
    backgroundColor: partial?.backgroundColor ?? defaults.backgroundColor,
    foregroundColor: partial?.foregroundColor ?? defaults.foregroundColor,
    cardColor: partial?.cardColor ?? defaults.cardColor,
    mutedColor: partial?.mutedColor ?? defaults.mutedColor,
    borderColor: partial?.borderColor ?? defaults.borderColor,
    sidebarBackgroundColor:
      partial?.sidebarBackgroundColor ?? defaults.sidebarBackgroundColor,
    sidebarForegroundColor:
      partial?.sidebarForegroundColor ?? defaults.sidebarForegroundColor,
  };
}

export function deriveLightPalette(dark: BrandPaletteDto): BrandPaletteDto {
  return resolvePalette(
    {
      primaryColor: dark.primaryColor,
      accentColor: dark.accentColor,
    },
    DEFAULT_LIGHT,
  );
}

export function darkPaletteFromRow(row: {
  primaryColor: string;
  accentColor: string | null;
  backgroundColor: string | null;
  foregroundColor: string | null;
  cardColor: string | null;
  mutedColor: string | null;
  borderColor: string | null;
  sidebarBackgroundColor: string | null;
  sidebarForegroundColor: string | null;
}): BrandPaletteDto {
  return resolvePalette(
    {
      primaryColor: row.primaryColor,
      accentColor: row.accentColor ?? DEFAULT_DARK.accentColor,
      backgroundColor: row.backgroundColor ?? undefined,
      foregroundColor: row.foregroundColor ?? undefined,
      cardColor: row.cardColor ?? undefined,
      mutedColor: row.mutedColor ?? undefined,
      borderColor: row.borderColor ?? undefined,
      sidebarBackgroundColor: row.sidebarBackgroundColor ?? undefined,
      sidebarForegroundColor: row.sidebarForegroundColor ?? undefined,
    },
    DEFAULT_DARK,
  );
}

export function lightPaletteFromRow(
  row: { lightPalette: Record<string, string> | null },
  dark: BrandPaletteDto,
): BrandPaletteDto {
  const stored = row.lightPalette;
  if (!stored) {
    return deriveLightPalette(dark);
  }

  const partial: Partial<BrandPaletteDto> = {};
  for (const key of PALETTE_KEYS) {
    const value = stored[key];
    if (typeof value === "string") {
      partial[key] = value;
    }
  }

  return resolvePalette(partial, deriveLightPalette(dark));
}

export function paletteToStorage(
  palette: BrandPaletteDto,
): Record<string, string> {
  return { ...palette };
}
