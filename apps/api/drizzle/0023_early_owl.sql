CREATE TABLE "user_notification_preference" (
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
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_preference_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_notification_workspace_project" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_rule_id" text NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_workspace_project_rule_project_unique" UNIQUE("workspace_rule_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "user_notification_workspace_rule" (
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
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_workspace_rule_user_workspace_unique" UNIQUE("user_id","workspace_id"),
	CONSTRAINT "user_notification_workspace_rule_workspace_id_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD CONSTRAINT "user_notification_workspace_project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD CONSTRAINT "user_notification_workspace_project_workspace_id_workspace_rule_id_user_notification_workspace_rule_workspace_id_id_fk" FOREIGN KEY ("workspace_id","workspace_rule_id") REFERENCES "public"."user_notification_workspace_rule"("workspace_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD CONSTRAINT "user_notification_workspace_project_workspace_id_project_id_project_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification_workspace_rule" ADD CONSTRAINT "user_notification_workspace_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification_workspace_rule" ADD CONSTRAINT "user_notification_workspace_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_notification_workspace_project_ruleId_idx" ON "user_notification_workspace_project" USING btree ("workspace_rule_id");--> statement-breakpoint
CREATE INDEX "user_notification_workspace_project_projectId_idx" ON "user_notification_workspace_project" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "user_notification_workspace_rule_userId_idx" ON "user_notification_workspace_rule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_notification_workspace_rule_workspaceId_idx" ON "user_notification_workspace_rule" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_id_unique" UNIQUE("workspace_id","id");