CREATE TABLE "agent_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_effect" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"action" jsonb NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"applied_at" timestamp,
	"undone_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_run" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"request_id" text NOT NULL,
	"prompt" text NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"model" text NOT NULL,
	"error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "agent_run_request_unique" UNIQUE("conversation_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "agent_step" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"summary" text,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "agent_step_call_unique" UNIQUE("run_id","tool_call_id")
);
--> statement-breakpoint
ALTER TABLE "agent_conversation" ADD CONSTRAINT "agent_conversation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_conversation" ADD CONSTRAINT "agent_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_conversation" ADD CONSTRAINT "agent_conversation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_effect" ADD CONSTRAINT "agent_effect_proposal_id_agent_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."agent_proposal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_effect" ADD CONSTRAINT "agent_effect_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposal" ADD CONSTRAINT "agent_proposal_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_conversation_id_agent_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_step" ADD CONSTRAINT "agent_step_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_conversation_owner_idx" ON "agent_conversation" USING btree ("workspace_id","user_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_effect_pending_idx" ON "agent_effect" USING btree ("delivered_at","created_at");--> statement-breakpoint
CREATE INDEX "agent_proposal_run_idx" ON "agent_proposal" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_run_queue_idx" ON "agent_run" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "agent_run_conversation_idx" ON "agent_run" USING btree ("conversation_id","created_at");