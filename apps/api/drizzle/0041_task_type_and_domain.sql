ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "task_type" text DEFAULT 'feat' NOT NULL;
--> statement-breakpoint
UPDATE "task" SET "task_type" = 'feat' WHERE "task_type" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_partner" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"cpf" text,
	"role" text,
	"ownership_percent" integer,
	"email" text,
	"phone" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_partner" ADD CONSTRAINT "client_partner_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_partner_client_id_idx" ON "client_partner" USING btree ("client_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_partner_cpf_unique" ON "client_partner" USING btree ("cpf") WHERE "cpf" is not null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"original_filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"field_map" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body_html" text,
	"preview_html" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_template" ADD CONSTRAINT "contract_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_template" ADD CONSTRAINT "contract_template_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_template_workspace_id_idx" ON "contract_template" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_template_created_by_idx" ON "contract_template" USING btree ("created_by");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"client_id" text NOT NULL,
	"template_id" text NOT NULL,
	"docuseal_submission_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signed_pdf_asset_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_submission" ADD CONSTRAINT "contract_submission_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_submission" ADD CONSTRAINT "contract_submission_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_submission" ADD CONSTRAINT "contract_submission_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_submission" ADD CONSTRAINT "contract_submission_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_submission" ADD CONSTRAINT "contract_submission_template_id_contract_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_template"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_submission" ADD CONSTRAINT "contract_submission_signed_pdf_asset_id_asset_id_fk" FOREIGN KEY ("signed_pdf_asset_id") REFERENCES "public"."asset"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_submission" ADD CONSTRAINT "contract_submission_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_submission_workspace_id_idx" ON "contract_submission" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_submission_project_id_idx" ON "contract_submission" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_submission_task_id_idx" ON "contract_submission" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_submission_client_id_idx" ON "contract_submission" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_submission_template_id_idx" ON "contract_submission" USING btree ("template_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contract_submission_docuseal_id_unique" ON "contract_submission" USING btree ("docuseal_submission_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cal_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"kind" text DEFAULT 'scheduling_link' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"title" text,
	"notes" text,
	"cal_booking_id" text,
	"cal_booking_uid" text,
	"event_type_id" text,
	"event_type_slug" text,
	"scheduling_url" text,
	"meeting_url" text,
	"attendees" jsonb,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cal_booking" ADD CONSTRAINT "cal_booking_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cal_booking" ADD CONSTRAINT "cal_booking_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cal_booking_taskId_idx" ON "cal_booking" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cal_booking_calBookingUid_idx" ON "cal_booking" USING btree ("cal_booking_uid");
