CREATE TABLE "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"user_id" text,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"html" text NOT NULL,
	"text" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"provider" text,
	"provider_id" text,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "email_outbox_status_next_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_outbox_workspace_created_idx" ON "email_outbox" USING btree ("workspace_id","created_at");