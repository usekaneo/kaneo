import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { settings } from "./schema/auth";
import { seedSystemData, CATALOGUE_VERSION } from "./seed-system";

export async function initializeQuillsWorkspace(
  db: Database,
  workspace: { workspaceId: string; name: string; slug: string },
): Promise<void> {
  const existing = (
    await db
      .select({
        id: settings.id,
        name: settings.name,
        slug: settings.slug,
        version: settings.catalogueVersion,
      })
      .from(settings)
      .limit(1)
  )[0];
  if (existing?.version === CATALOGUE_VERSION) {
    if (existing.name !== workspace.name || existing.slug !== workspace.slug)
      await db
        .update(settings)
        .set({ name: workspace.name, slug: workspace.slug });
    return;
  }
  await db.execute(
    sql`select pg_advisory_xact_lock(48204, hashtext(${workspace.workspaceId}))`,
  );
  const current = (
    await db
      .select({ version: settings.catalogueVersion })
      .from(settings)
      .limit(1)
  )[0];
  if (current && current.version > CATALOGUE_VERSION)
    throw new Error("Quills catalogue is newer than this application");
  if (current?.version === CATALOGUE_VERSION) return;
  await seedSystemData(db);
  if (current) {
    await db.update(settings).set({ catalogueVersion: CATALOGUE_VERSION });
    return;
  }
  await db.insert(settings).values({
    catalogueVersion: CATALOGUE_VERSION,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: new Date(),
  });
}
