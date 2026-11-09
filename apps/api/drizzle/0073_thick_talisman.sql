ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "include_subtasks" boolean DEFAULT true NOT NULL;
