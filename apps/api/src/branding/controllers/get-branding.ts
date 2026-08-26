import { desc } from "drizzle-orm";
import db, { schema } from "../../database";
import ensureBrandingChromeColumns from "../ensure-chrome-columns";
import {
  type BrandingDto,
  type BrandPaletteDto,
  darkPaletteFromRow,
  lightPaletteFromRow,
} from "../palette-utils";

export type { BrandingDto, BrandPaletteDto };

const DEFAULTS: BrandingDto = {
  displayName: process.env.APP_NAME || "ElseTasks",
  logoUrl: process.env.APP_LOGO_URL || null,
  logoDarkUrl: process.env.APP_LOGO_DARK_URL || null,
  faviconUrl: null,
  primaryColor: process.env.APP_PRIMARY_COLOR || "#0F766E",
  accentColor: "#14B8A6",
  backgroundColor: "#0C0C0C",
  foregroundColor: "#F5F5F5",
  cardColor: "#141414",
  mutedColor: "#1F1F1F",
  borderColor: "#2A2A2A",
  sidebarBackgroundColor: "#0F0F0F",
  sidebarForegroundColor: "#A3A3A3",
  paletteLight: {
    primaryColor: process.env.APP_PRIMARY_COLOR || "#0F766E",
    accentColor: "#14B8A6",
    backgroundColor: "#FFFFFF",
    foregroundColor: "#262626",
    cardColor: "#FFFFFF",
    mutedColor: "#F5F5F5",
    borderColor: "#E5E5E5",
    sidebarBackgroundColor: "#FAFAFA",
    sidebarForegroundColor: "#737373",
  },
  setupCompleted: false,
};

function rowToDto(
  row: typeof schema.instanceBrandingTable.$inferSelect,
): BrandingDto {
  const paletteDark = darkPaletteFromRow(row);
  const paletteLight = lightPaletteFromRow(row, paletteDark);

  return {
    displayName: row.displayName,
    logoUrl: row.logoUrl,
    logoDarkUrl: row.logoDarkUrl,
    faviconUrl: row.faviconUrl,
    ...paletteDark,
    paletteLight,
    setupCompleted: row.setupCompleted,
  };
}

export default async function getBranding(): Promise<BrandingDto> {
  await ensureBrandingChromeColumns();
  const [row] = await db
    .select()
    .from(schema.instanceBrandingTable)
    .orderBy(desc(schema.instanceBrandingTable.createdAt))
    .limit(1);

  if (!row) {
    return DEFAULTS;
  }

  return rowToDto(row);
}
