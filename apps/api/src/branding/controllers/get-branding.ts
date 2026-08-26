import { desc } from "drizzle-orm";
import db, { schema } from "../../database";
import ensureBrandingChromeColumns from "../ensure-chrome-columns";

export type BrandingDto = {
  displayName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  mutedColor: string;
  borderColor: string;
  sidebarBackgroundColor: string;
  sidebarForegroundColor: string;
  setupCompleted: boolean;
};

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
  setupCompleted: false,
};

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

  return {
    displayName: row.displayName,
    logoUrl: row.logoUrl,
    logoDarkUrl: row.logoDarkUrl,
    faviconUrl: row.faviconUrl,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor ?? DEFAULTS.accentColor,
    backgroundColor: row.backgroundColor ?? DEFAULTS.backgroundColor,
    foregroundColor: row.foregroundColor ?? DEFAULTS.foregroundColor,
    cardColor: row.cardColor ?? DEFAULTS.cardColor,
    mutedColor: row.mutedColor ?? DEFAULTS.mutedColor,
    borderColor: row.borderColor ?? DEFAULTS.borderColor,
    sidebarBackgroundColor:
      row.sidebarBackgroundColor ?? DEFAULTS.sidebarBackgroundColor,
    sidebarForegroundColor:
      row.sidebarForegroundColor ?? DEFAULTS.sidebarForegroundColor,
    setupCompleted: row.setupCompleted,
  };
}
