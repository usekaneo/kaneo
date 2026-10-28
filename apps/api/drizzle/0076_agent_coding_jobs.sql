CREATE TABLE "agent_job_changeset" (
	"job_id" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_job_event" (
	"sequence" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"phase" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_job" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"proposal_id" text,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"user_id" text NOT NULL,
	"integration_id" text,
	"request_id" text NOT NULL,
	"backend" text DEFAULT 'repo-ci' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"outcome" text,
	"phase" text,
	"progress" text,
	"instructions" text NOT NULL,
	"model" text NOT NULL,
	"workflow_ref" text,
	"workflow_sha" text,
	"repository_owner" text NOT NULL,
	"repository_name" text NOT NULL,
	"repository_id" bigint NOT NULL,
	"base_ref" text,
	"base_sha" text,
	"branch" text NOT NULL,
	"external_ref" text,
	"external_url" text,
	"credential_hash" text,
	"commit_sha" text,
	"pr_number" integer,
	"pr_url" text,
	"summary" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp,
	"heartbeat_at" timestamp,
	"deadline" timestamp NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"dispatched_at" timestamp,
	"started_at" timestamp,
	"finished_at" timestamp,
	CONSTRAINT "agent_job_proposal_id_unique" UNIQUE("proposal_id"),
	CONSTRAINT "agent_job_request_unique" UNIQUE("workspace_id","user_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "agent_job_changeset" ADD CONSTRAINT "agent_job_changeset_job_id_agent_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."agent_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job_event" ADD CONSTRAINT "agent_job_event_job_id_agent_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."agent_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_proposal_id_agent_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."agent_proposal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_job_event_job_idx" ON "agent_job_event" USING btree ("job_id","sequence");--> statement-breakpoint
CREATE INDEX "agent_job_queue_idx" ON "agent_job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "agent_job_run_idx" ON "agent_job" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_job_owner_idx" ON "agent_job" USING btree ("workspace_id","user_id","created_at");