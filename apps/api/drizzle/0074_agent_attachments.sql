CREATE TABLE "agent_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_attachment" ADD CONSTRAINT "agent_attachment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_attachment" ADD CONSTRAINT "agent_attachment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_attachment" ADD CONSTRAINT "agent_attachment_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_attachment_owner_idx" ON "agent_attachment" USING btree ("user_id","workspace_id","run_id");--> statement-breakpoint
CREATE INDEX "agent_attachment_run_idx" ON "agent_attachment" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_attachment_pending_idx" ON "agent_attachment" USING btree ("created_at") WHERE "agent_attachment"."run_id" is null;