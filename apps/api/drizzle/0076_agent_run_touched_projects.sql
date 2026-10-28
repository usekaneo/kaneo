ALTER TABLE "agent_run" ADD COLUMN "touched_project_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Earlier runs did not record what they read. Project-scoped runs could only
-- read their project; workspace-scoped ones get "*", which matches no project,
-- so they stay owner-only when shared.
UPDATE "agent_run" SET "touched_project_ids" = CASE WHEN "agent_conversation"."project_id" IS NULL THEN ARRAY['*'] ELSE ARRAY["agent_conversation"."project_id"] END FROM "agent_conversation" WHERE "agent_conversation"."id" = "agent_run"."conversation_id";
