import { desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import ensureBrandingChromeColumns from "../ensure-chrome-columns";
import getBranding, { type BrandingDto } from "./get-branding";

export default async function updateBranding(
  input: Partial<BrandingDto>,
): Promise<BrandingDto> {
  await ensureBrandingChromeColumns();
  const [existing] = await db
    .select()
    .from(schema.instanceBrandingTable)
    .orderBy(desc(schema.instanceBrandingTable.createdAt))
    .limit(1);

  if (!existing) {
    await db.insert(schema.instanceBrandingTable).values({
      displayName: input.displayName ?? process.env.APP_NAME ?? "ElseTasks",
      logoUrl: input.logoUrl ?? null,
      logoDarkUrl: input.logoDarkUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
      primaryColor: input.primaryColor ?? "#0F766E",
      accentColor: input.accentColor ?? null,
      backgroundColor: input.backgroundColor ?? "#0C0C0C",
      foregroundColor: input.foregroundColor ?? "#F5F5F5",
      cardColor: input.cardColor ?? "#141414",
      mutedColor: input.mutedColor ?? "#1F1F1F",
      borderColor: input.borderColor ?? "#2A2A2A",
      sidebarBackgroundColor: input.sidebarBackgroundColor ?? "#0F0F0F",
      sidebarForegroundColor: input.sidebarForegroundColor ?? "#A3A3A3",
      setupCompleted: input.setupCompleted ?? false,
    });
  } else {
    await db
      .update(schema.instanceBrandingTable)
      .set({
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.logoDarkUrl !== undefined
          ? { logoDarkUrl: input.logoDarkUrl }
          : {}),
        ...(input.faviconUrl !== undefined
          ? { faviconUrl: input.faviconUrl }
          : {}),
        ...(input.primaryColor !== undefined
          ? { primaryColor: input.primaryColor }
          : {}),
        ...(input.accentColor !== undefined
          ? { accentColor: input.accentColor }
          : {}),
        ...(input.backgroundColor !== undefined
          ? { backgroundColor: input.backgroundColor }
          : {}),
        ...(input.foregroundColor !== undefined
          ? { foregroundColor: input.foregroundColor }
          : {}),
        ...(input.cardColor !== undefined
          ? { cardColor: input.cardColor }
          : {}),
        ...(input.mutedColor !== undefined
          ? { mutedColor: input.mutedColor }
          : {}),
        ...(input.borderColor !== undefined
          ? { borderColor: input.borderColor }
          : {}),
        ...(input.sidebarBackgroundColor !== undefined
          ? { sidebarBackgroundColor: input.sidebarBackgroundColor }
          : {}),
        ...(input.sidebarForegroundColor !== undefined
          ? { sidebarForegroundColor: input.sidebarForegroundColor }
          : {}),
        ...(input.setupCompleted !== undefined
          ? { setupCompleted: input.setupCompleted }
          : {}),
      })
      .where(eq(schema.instanceBrandingTable.id, existing.id));
  }

  return getBranding();
}
