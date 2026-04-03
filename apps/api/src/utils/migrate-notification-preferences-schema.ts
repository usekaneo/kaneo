import { sql } from "drizzle-orm";
import db from "../database";

/**
 * Repairs notification preference tables for instances where migration state
 * drift left the schema partially applied.
 */
export async function migrateNotificationPreferencesSchema() {
  console.log("🔄 Checking notification preference schema...");

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_notification_preference" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "email_enabled" boolean DEFAULT false NOT NULL,
        "ntfy_enabled" boolean DEFAULT false NOT NULL,
        "ntfy_server_url" text,
        "ntfy_topic" text,
        "ntfy_token" text,
        "gotify_enabled" boolean DEFAULT false NOT NULL,
        "gotify_server_url" text,
        "gotify_token" text,
        "webhook_enabled" boolean DEFAULT false NOT NULL,
        "webhook_url" text,
        "webhook_secret" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    await db.execute(sql`
      ALTER TABLE "user_notification_preference"
      ADD COLUMN IF NOT EXISTS "email_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "ntfy_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "ntfy_server_url" text,
      ADD COLUMN IF NOT EXISTS "ntfy_topic" text,
      ADD COLUMN IF NOT EXISTS "ntfy_token" text,
      ADD COLUMN IF NOT EXISTS "gotify_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "gotify_server_url" text,
      ADD COLUMN IF NOT EXISTS "gotify_token" text,
      ADD COLUMN IF NOT EXISTS "webhook_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "webhook_url" text,
      ADD COLUMN IF NOT EXISTS "webhook_secret" text,
      ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_notification_workspace_rule" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "workspace_id" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "email_enabled" boolean DEFAULT false NOT NULL,
        "ntfy_enabled" boolean DEFAULT false NOT NULL,
        "gotify_enabled" boolean DEFAULT false NOT NULL,
        "webhook_enabled" boolean DEFAULT false NOT NULL,
        "project_mode" text DEFAULT 'all' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    await db.execute(sql`
      ALTER TABLE "user_notification_workspace_rule"
      ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS "email_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "ntfy_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "gotify_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "webhook_enabled" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "project_mode" text DEFAULT 'all' NOT NULL,
      ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_notification_workspace_project" (
        "id" text PRIMARY KEY NOT NULL,
        "workspace_id" text NOT NULL,
        "workspace_rule_id" text NOT NULL,
        "project_id" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    await db.execute(sql`
      ALTER TABLE "user_notification_workspace_project"
      ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_notification_preference_user_id_unique"
      ON "user_notification_preference" ("user_id");
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_notification_workspace_rule_user_workspace_unique"
      ON "user_notification_workspace_rule" ("user_id", "workspace_id");
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_notification_workspace_rule_workspace_id_id_unique"
      ON "user_notification_workspace_rule" ("workspace_id", "id");
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_notification_workspace_project_rule_project_unique"
      ON "user_notification_workspace_project" ("workspace_rule_id", "project_id");
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "user_notification_workspace_rule_userId_idx"
      ON "user_notification_workspace_rule" ("user_id");
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "user_notification_workspace_rule_workspaceId_idx"
      ON "user_notification_workspace_rule" ("workspace_id");
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "user_notification_workspace_project_ruleId_idx"
      ON "user_notification_workspace_project" ("workspace_rule_id");
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "user_notification_workspace_project_projectId_idx"
      ON "user_notification_workspace_project" ("project_id");
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'user_notification_preference_user_id_user_id_fk'
        ) THEN
          ALTER TABLE "user_notification_preference"
          ADD CONSTRAINT "user_notification_preference_user_id_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
          ON DELETE cascade ON UPDATE cascade;
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'user_notification_workspace_rule_user_id_user_id_fk'
        ) THEN
          ALTER TABLE "user_notification_workspace_rule"
          ADD CONSTRAINT "user_notification_workspace_rule_user_id_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
          ON DELETE cascade ON UPDATE cascade;
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'user_notification_workspace_rule_workspace_id_workspace_id_fk'
        ) THEN
          ALTER TABLE "user_notification_workspace_rule"
          ADD CONSTRAINT "user_notification_workspace_rule_workspace_id_workspace_id_fk"
          FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id")
          ON DELETE cascade ON UPDATE cascade;
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'user_notification_workspace_project_workspace_id_workspace_id_fk'
        ) THEN
          ALTER TABLE "user_notification_workspace_project"
          ADD CONSTRAINT "user_notification_workspace_project_workspace_id_workspace_id_fk"
          FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id")
          ON DELETE cascade ON UPDATE cascade;
        END IF;
      END $$;
    `);

    console.log("✅ Notification preference schema check complete!");
  } catch (error) {
    console.error("❌ Error during notification preference migration:", error);
    throw error;
  }
}
