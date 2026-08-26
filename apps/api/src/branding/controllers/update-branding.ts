import { desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import ensureBrandingChromeColumns from "../ensure-chrome-columns";
import {
  type BrandPaletteDto,
  darkPaletteFromRow,
  deriveLightPalette,
  lightPaletteFromRow,
  paletteToStorage,
} from "../palette-utils";
import getBranding, { type BrandingDto } from "./get-branding";

type UpdateInput = Partial<
  Omit<BrandingDto, "accentColor" | "paletteLight">
> & {
  accentColor?: string | null;
  paletteLight?: Partial<BrandPaletteDto> | null;
};

function darkFieldsFromInput(input: UpdateInput): Partial<BrandPaletteDto> {
  return {
    ...(input.primaryColor !== undefined
      ? { primaryColor: input.primaryColor }
      : {}),
    ...(input.accentColor !== undefined
      ? { accentColor: input.accentColor ?? undefined }
      : {}),
    ...(input.backgroundColor !== undefined
      ? { backgroundColor: input.backgroundColor }
      : {}),
    ...(input.foregroundColor !== undefined
      ? { foregroundColor: input.foregroundColor }
      : {}),
    ...(input.cardColor !== undefined ? { cardColor: input.cardColor } : {}),
    ...(input.mutedColor !== undefined ? { mutedColor: input.mutedColor } : {}),
    ...(input.borderColor !== undefined
      ? { borderColor: input.borderColor }
      : {}),
    ...(input.sidebarBackgroundColor !== undefined
      ? { sidebarBackgroundColor: input.sidebarBackgroundColor }
      : {}),
    ...(input.sidebarForegroundColor !== undefined
      ? { sidebarForegroundColor: input.sidebarForegroundColor }
      : {}),
  };
}

function mergeLightPalette(
  existing: typeof schema.instanceBrandingTable.$inferSelect | undefined,
  dark: BrandPaletteDto,
  patch: Partial<BrandPaletteDto> | null | undefined,
): Record<string, string> | null {
  if (patch === null) {
    return null;
  }
  if (!patch) {
    return existing?.lightPalette ?? null;
  }

  const base = existing
    ? lightPaletteFromRow(existing, dark)
    : deriveLightPalette(dark);

  return paletteToStorage({ ...base, ...patch });
}

export default async function updateBranding(
  input: UpdateInput,
): Promise<BrandingDto> {
  await ensureBrandingChromeColumns();
  const [existing] = await db
    .select()
    .from(schema.instanceBrandingTable)
    .orderBy(desc(schema.instanceBrandingTable.createdAt))
    .limit(1);

  const darkPatch = darkFieldsFromInput(input);

  if (!existing) {
    const darkDefaults = darkPaletteFromRow({
      primaryColor: darkPatch.primaryColor ?? "#0F766E",
      accentColor: darkPatch.accentColor ?? null,
      backgroundColor: darkPatch.backgroundColor ?? null,
      foregroundColor: darkPatch.foregroundColor ?? null,
      cardColor: darkPatch.cardColor ?? null,
      mutedColor: darkPatch.mutedColor ?? null,
      borderColor: darkPatch.borderColor ?? null,
      sidebarBackgroundColor: darkPatch.sidebarBackgroundColor ?? null,
      sidebarForegroundColor: darkPatch.sidebarForegroundColor ?? null,
    });

    await db.insert(schema.instanceBrandingTable).values({
      displayName: input.displayName ?? process.env.APP_NAME ?? "ElseTasks",
      logoUrl: input.logoUrl ?? null,
      logoDarkUrl: input.logoDarkUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
      primaryColor: darkDefaults.primaryColor,
      accentColor: darkDefaults.accentColor,
      backgroundColor: darkDefaults.backgroundColor,
      foregroundColor: darkDefaults.foregroundColor,
      cardColor: darkDefaults.cardColor,
      mutedColor: darkDefaults.mutedColor,
      borderColor: darkDefaults.borderColor,
      sidebarBackgroundColor: darkDefaults.sidebarBackgroundColor,
      sidebarForegroundColor: darkDefaults.sidebarForegroundColor,
      lightPalette: mergeLightPalette(
        undefined,
        darkDefaults,
        input.paletteLight,
      ),
      setupCompleted: input.setupCompleted ?? false,
    });
  } else {
    const currentDark = darkPaletteFromRow(existing);
    const nextDark: BrandPaletteDto = { ...currentDark, ...darkPatch };

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
        ...(darkPatch.primaryColor !== undefined
          ? { primaryColor: darkPatch.primaryColor }
          : {}),
        ...(input.accentColor !== undefined
          ? { accentColor: input.accentColor }
          : {}),
        ...(darkPatch.backgroundColor !== undefined
          ? { backgroundColor: darkPatch.backgroundColor }
          : {}),
        ...(darkPatch.foregroundColor !== undefined
          ? { foregroundColor: darkPatch.foregroundColor }
          : {}),
        ...(darkPatch.cardColor !== undefined
          ? { cardColor: darkPatch.cardColor }
          : {}),
        ...(darkPatch.mutedColor !== undefined
          ? { mutedColor: darkPatch.mutedColor }
          : {}),
        ...(darkPatch.borderColor !== undefined
          ? { borderColor: darkPatch.borderColor }
          : {}),
        ...(darkPatch.sidebarBackgroundColor !== undefined
          ? { sidebarBackgroundColor: darkPatch.sidebarBackgroundColor }
          : {}),
        ...(darkPatch.sidebarForegroundColor !== undefined
          ? { sidebarForegroundColor: darkPatch.sidebarForegroundColor }
          : {}),
        ...(input.paletteLight !== undefined
          ? {
              lightPalette: mergeLightPalette(
                existing,
                nextDark,
                input.paletteLight,
              ),
            }
          : {}),
        ...(input.setupCompleted !== undefined
          ? { setupCompleted: input.setupCompleted }
          : {}),
      })
      .where(eq(schema.instanceBrandingTable.id, existing.id));
  }

  return getBranding();
}
