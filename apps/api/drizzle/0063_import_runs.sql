CREATE TABLE "import_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"include_comments" boolean DEFAULT true NOT NULL,
	"message" text,
	"projects" jsonb NOT NULL,
	"error" text,
	"heartbeat_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "import_run" ADD CONSTRAINT "import_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_run" ADD CONSTRAINT "import_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "import_run_workspace_created_idx" ON "import_run" USING btree ("workspace_id","created_at");