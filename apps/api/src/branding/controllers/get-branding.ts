import { desc } from "drizzle-orm";
import db, { schema } from "../../database";

export type BrandingDto = {
  displayName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  setupCompleted: boolean;
};

const DEFAULTS: BrandingDto = {
  displayName: process.env.APP_NAME || "ElseTasks",
  logoUrl: process.env.APP_LOGO_URL || null,
  logoDarkUrl: process.env.APP_LOGO_DARK_URL || null,
  faviconUrl: null,
  primaryColor: process.env.APP_PRIMARY_COLOR || "#0F766E",
  accentColor: "#14B8A6",
  setupCompleted: false,
};

export default async function getBranding(): Promise<BrandingDto> {
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
    setupCompleted: row.setupCompleted,
  };
}
