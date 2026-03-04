import { sql } from "drizzle-orm";
import db from "../database";

/**
 * Ensures API key schema matches Better Auth expectations:
 * - reference_id exists and is populated from user_id when needed
 * - config_id exists with default value
 * - user_id is nullable (Better Auth inserts reference_id, not user_id)
 */
export async function migrateApiKeyReferenceId() {
  console.log("🔄 Checking apikey table reference_id migration...");

  try {
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'apikey'
      ) AS exists;
    `);

    const exists =
      tableExists.rows[0]?.exists === true ||
      tableExists.rows[0]?.exists === "t";
    if (!exists) {
      console.log("🛈 apikey table does not exist — skipping migration.");
      return;
    }

    const hasReferenceIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'apikey'
      AND column_name = 'reference_id'
    `);

    const hasConfigIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'apikey'
      AND column_name = 'config_id'
    `);

    const hasUserIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'apikey'
      AND column_name = 'user_id'
    `);

    if (hasReferenceIdColumn.rows.length === 0) {
      console.log("➕ Adding reference_id column to apikey...");
      await db.execute(sql`
        ALTER TABLE "apikey" ADD COLUMN "reference_id" text;
      `);
    }

    if (hasConfigIdColumn.rows.length === 0) {
      console.log("➕ Adding config_id column to apikey...");
      await db.execute(sql`
        ALTER TABLE "apikey" ADD COLUMN "config_id" text DEFAULT 'default';
      `);
    }

    if (hasUserIdColumn.rows.length > 0) {
      await db.execute(sql`
        UPDATE "apikey"
        SET "reference_id" = "user_id"
        WHERE "reference_id" IS NULL AND "user_id" IS NOT NULL;
      `);

      // Better Auth creates keys with reference_id and can leave user_id null.
      await db.execute(sql`
        ALTER TABLE "apikey"
        ALTER COLUMN "user_id" DROP NOT NULL;
      `);
    }

    await db.execute(sql`
      UPDATE "apikey"
      SET "config_id" = 'default'
      WHERE "config_id" IS NULL;
    `);

    const hasConfigIndex = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'apikey'
      AND indexname = 'apikey_configId_idx'
    `);

    if (hasConfigIndex.rows.length === 0) {
      await db.execute(sql`
        CREATE INDEX "apikey_configId_idx" ON "apikey" ("config_id");
      `);
    }

    const hasReferenceIndex = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'apikey'
      AND indexname = 'apikey_referenceId_idx'
    `);

    if (hasReferenceIndex.rows.length === 0) {
      await db.execute(sql`
        CREATE INDEX "apikey_referenceId_idx" ON "apikey" ("reference_id");
      `);
    }

    const hasKeyIndex = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'apikey'
      AND indexname = 'apikey_key_idx'
    `);

    if (hasKeyIndex.rows.length === 0) {
      await db.execute(sql`
        CREATE INDEX "apikey_key_idx" ON "apikey" ("key");
      `);
    }

    console.log("✅ API key reference_id migration completed successfully!");
  } catch (error) {
    console.error("❌ Error during apikey migration:", error);
    throw error;
  }
}
