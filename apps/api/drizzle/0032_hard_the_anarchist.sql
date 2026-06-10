CREATE TABLE "glance_user_prefs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"group_by" text DEFAULT 'workspace' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "glance_user_prefs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "glance_user_prefs" ADD CONSTRAINT "glance_user_prefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "glance_user_prefs_userId_idx" ON "glance_user_prefs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_userId_idx" ON "activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "asset_createdBy_idx" ON "asset" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "invitation_inviterId_idx" ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "notification_userId_idx" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_assigneeId_idx" ON "task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "task_columnId_idx" ON "task" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "time_entry_taskId_idx" ON "time_entry" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "time_entry_userId_idx" ON "time_entry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_notification_workspace_project_workspaceId_projectId_idx" ON "user_notification_workspace_project" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "unwp_workspaceId_workspaceRuleId_idx" ON "user_notification_workspace_project" USING btree ("workspace_id","workspace_rule_id");--> statement-breakpoint
CREATE INDEX "workflow_rule_columnId_idx" ON "workflow_rule" USING btree ("column_id");