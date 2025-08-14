-- Migration: Convert task-scoped labels to workspace-scoped labels
-- Step 1: Create task_label junction table
CREATE TABLE "task_label" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"label_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Step 2: Add workspace_id column as nullable initially
ALTER TABLE "label" ADD COLUMN "workspace_id" text;

-- Step 3: Populate workspace_id for existing labels by looking up through task -> project -> workspace
UPDATE "label"
SET "workspace_id" = (
  SELECT p."workspace_id"
  FROM "task" t
  JOIN "project" p ON t."project_id" = p."id"
  WHERE t."id" = "label"."task_id"
)
WHERE "workspace_id" IS NULL AND "task_id" IS NOT NULL;

-- Step 4: For any labels where workspace lookup failed, assign to first available workspace
UPDATE "label"
SET "workspace_id" = (SELECT "id" FROM "workspace" LIMIT 1)
WHERE "workspace_id" IS NULL;

-- Step 5: Create task_label relationships for existing labels
INSERT INTO "task_label" ("id", "task_id", "label_id", "created_at")
SELECT
  'tl_' || substr(md5(random()::text), 1, 25) as "id",
  "task_id",
  "id" as "label_id",
  "created_at"
FROM "label"
WHERE "task_id" IS NOT NULL;

-- Step 6: Now make workspace_id NOT NULL and add constraints
ALTER TABLE "label" ALTER COLUMN "workspace_id" SET NOT NULL;

-- Step 7: Add foreign key constraints
ALTER TABLE "task_label" ADD CONSTRAINT "task_label_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_label" ADD CONSTRAINT "task_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;

-- Step 8: Drop old constraints and task_id column
ALTER TABLE "label" DROP CONSTRAINT "label_task_id_task_id_fk";--> statement-breakpoint
ALTER TABLE "label" DROP COLUMN "task_id";

-- Step 9: Add indexes for better performance
CREATE INDEX IF NOT EXISTS "task_label_task_id_idx" ON "task_label" ("task_id");
CREATE INDEX IF NOT EXISTS "task_label_label_id_idx" ON "task_label" ("label_id");
CREATE INDEX IF NOT EXISTS "label_workspace_id_idx" ON "label" ("workspace_id");