CREATE TABLE "workspace_holiday" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_holiday_workspace_id_date_unique" UNIQUE("workspace_id","date")
);
--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "working_days" integer DEFAULT 62 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_holiday" ADD CONSTRAINT "workspace_holiday_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "workspace_holiday_workspaceId_idx" ON "workspace_holiday" USING btree ("workspace_id");