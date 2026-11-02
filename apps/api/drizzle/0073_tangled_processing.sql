CREATE TABLE "tangled_integration_state" (
	"integration_id" text PRIMARY KEY NOT NULL,
	"event_type" text,
	"outcome" text,
	"code" text,
	"ref" text,
	"checked_at" timestamp,
	"last_scan_at" timestamp,
	"scan_offset" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tangled_integration_state" ADD CONSTRAINT "tangled_integration_state_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE cascade;