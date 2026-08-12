import { desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import getBranding, { type BrandingDto } from "./get-branding";

export default async function updateBranding(
  input: Partial<BrandingDto>,
): Promise<BrandingDto> {
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
        ...(input.setupCompleted !== undefined
          ? { setupCompleted: input.setupCompleted }
          : {}),
      })
      .where(eq(schema.instanceBrandingTable.id, existing.id));
  }

  return getBranding();
}
