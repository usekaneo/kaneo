CREATE TABLE "agent_automation_event" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "agent_automation_event_dedupe_unique" UNIQUE("automation_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "agent_automation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"model" text NOT NULL,
	"output" text NOT NULL,
	"trigger" jsonb NOT NULL,
	"event_type" text,
	"next_run_at" timestamp,
	"event_cursor_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"paused_reason" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"daily_run_limit" integer DEFAULT 24 NOT NULL,
	"last_skip_reason" text,
	"last_skipped_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_conversation" ADD COLUMN "automation_id" text;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "trigger" jsonb;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "automation_handled_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_automation_event" ADD CONSTRAINT "agent_automation_event_automation_id_agent_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."agent_automation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_automation" ADD CONSTRAINT "agent_automation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_automation" ADD CONSTRAINT "agent_automation_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_automation" ADD CONSTRAINT "agent_automation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_automation_event_pending_idx" ON "agent_automation_event" USING btree ("automation_id","created_at") WHERE "agent_automation_event"."consumed_at" is null;--> statement-breakpoint
CREATE INDEX "agent_automation_workspace_idx" ON "agent_automation" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_automation_due_idx" ON "agent_automation" USING btree ("next_run_at") WHERE "agent_automation"."enabled" and "agent_automation"."next_run_at" is not null;--> statement-breakpoint
CREATE INDEX "agent_automation_event_idx" ON "agent_automation" USING btree ("workspace_id","event_type") WHERE "agent_automation"."enabled" and "agent_automation"."event_type" is not null;--> statement-breakpoint
ALTER TABLE "agent_conversation" ADD CONSTRAINT "agent_conversation_automation_id_agent_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."agent_automation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_conversation_automation_owner_scope_uidx" ON "agent_conversation" USING btree ("automation_id","user_id",coalesce("project_id", '')) WHERE "agent_conversation"."automation_id" is not null;
--> statement-breakpoint

CREATE INDEX "agent_run_automation_completion_idx" ON "agent_run" USING btree ("finished_at","id") WHERE "agent_run"."trigger" is not null and "agent_run"."automation_handled_at" is null and "agent_run"."status" in ('completed', 'awaiting_review', 'failed', 'cancelled');
--> statement-breakpoint

-- Grant the new management permission to existing built-in admins, preserving
-- every other customized permission. Owners use the static permission role.
UPDATE workspace_role SET permission = jsonb_set(permission::jsonb, '{agent}',
  coalesce(permission::jsonb -> 'agent', '[]'::jsonb) || '["manage_automations"]'::jsonb)::text
WHERE role = 'admin' AND NOT coalesce(permission::jsonb -> 'agent', '[]'::jsonb) ? 'manage_automations';
