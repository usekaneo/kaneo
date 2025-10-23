import { sql } from "drizzle-orm";
import db from "../database";

/**
 * Migration script to handle conversion from user_email to user_id in workspace_member table.
 * This runs before Drizzle migrations to ensure no NULL user_id values exist and prevents
 * column collision errors during migration.
 */
export async function migrateWorkspaceUserEmail() {
  console.log(
    "🔄 Checking workspace_member table for user_email to user_id migration...",
  );

  try {
    const tableExists = await db.execute(sql`
         SELECT EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_name = 'workspace_member'
         ) AS exists;
       `);

    const exists =
      tableExists.rows[0]?.exists === true ||
      tableExists.rows[0]?.exists === "t";
    if (!exists) {
      console.log(
        "🛈 workspace_member table does not exist — skipping migration.",
      );
      return;
    }

    // Check if user_email column still exists
    const hasUserEmailColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'workspace_member'
      AND column_name = 'user_email'
    `);

    // Check if user_id column already exists
    const hasUserIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'workspace_member'
      AND column_name = 'user_id'
    `);

    if (hasUserEmailColumn.rows.length > 0) {
      console.log("📧 Found user_email column, migrating to user_id...");

      // Add user_id column if it doesn't exist
      if (hasUserIdColumn.rows.length === 0) {
        await db.execute(sql`
          ALTER TABLE "workspace_member" ADD COLUMN "user_id" text;
        `);
        console.log("➕ Added user_id column");
      }

      // Update user_id based on user_email
      await db.execute(sql`
        UPDATE "workspace_member"
        SET "user_id" = (
          SELECT u.id
          FROM "user" u
          WHERE u.email = "workspace_member"."user_email"
        )
        WHERE "user_id" IS NULL AND "user_email" IS NOT NULL;
      `);

      // Remove records where user_email doesn't match any existing user
      const orphanedRecords = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM "workspace_member"
        WHERE "user_id" IS NULL AND "user_email" IS NOT NULL;
      `);

      if (
        orphanedRecords.rows[0]?.count &&
        Number(orphanedRecords.rows[0].count) > 0
      ) {
        console.log(
          `⚠️  Found ${orphanedRecords.rows[0].count} workspace_member records with invalid user_email. Removing them...`,
        );

        await db.execute(sql`
          DELETE FROM "workspace_member"
          WHERE "user_id" IS NULL AND "user_email" IS NOT NULL;
        `);
      }

      // Remove records where both user_email and user_id are NULL
      const nullRecords = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM "workspace_member"
        WHERE "user_id" IS NULL AND ("user_email" IS NULL OR "user_email" = '');
      `);

      if (nullRecords.rows[0]?.count && Number(nullRecords.rows[0].count) > 0) {
        console.log(
          `⚠️  Found ${nullRecords.rows[0].count} workspace_member records with no user identification. Removing them...`,
        );

        await db.execute(sql`
          DELETE FROM "workspace_member"
          WHERE "user_id" IS NULL AND ("user_email" IS NULL OR "user_email" = '');
        `);
      }

      // Drop the user_email column (completing the migration)
      await db.execute(sql`
        ALTER TABLE "workspace_member" DROP COLUMN "user_email";
      `);

      console.log(
        "✅ Successfully migrated user_email to user_id and dropped user_email column",
      );
    } else if (hasUserIdColumn.rows.length === 0) {
      // Neither column exists, add user_id column
      console.log("➕ Adding user_id column to workspace_member table...");
      await db.execute(sql`
        ALTER TABLE "workspace_member" ADD COLUMN "user_id" text;
      `);
    }

    // Check if there are any remaining NULL user_id values
    const nullUserIds = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM "workspace_member"
      WHERE "user_id" IS NULL;
    `);

    if (nullUserIds.rows[0]?.count && Number(nullUserIds.rows[0].count) > 0) {
      console.log(
        `⚠️  Found ${nullUserIds.rows[0].count} workspace_member records with NULL user_id. Removing them...`,
      );

      await db.execute(sql`
        DELETE FROM "workspace_member"
        WHERE "user_id" IS NULL;
      `);

      console.log("✅ Removed records with NULL user_id");
    }

    console.log("✅ Workspace member migration completed successfully!");
  } catch (error) {
    console.error("❌ Error during workspace member migration:", error);
    throw error;
  }
}
