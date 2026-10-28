CREATE TABLE "instance_webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status_code" integer,
	"error_code" text,
	"next_attempt_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"created_at" timestamp DEFAULT (statement_timestamp() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"categories" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"signing_secret" text NOT NULL,
	"cancel_pending_before" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instance_webhook_delivery" ADD CONSTRAINT "instance_webhook_delivery_webhook_id_instance_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."instance_webhook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instance_webhook_delivery_due_idx" ON "instance_webhook_delivery" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "instance_webhook_delivery_history_idx" ON "instance_webhook_delivery" USING btree ("webhook_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);