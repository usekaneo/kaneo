CREATE TABLE IF NOT EXISTS "client" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"cnpj" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"street" text,
	"number" text,
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text DEFAULT 'BR',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client" ADD CONSTRAINT "client_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_workspace_cnpj_unique" ON "client" USING btree ("workspace_id","cnpj");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_workspace_id_idx" ON "client" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_workspace_name_idx" ON "client" USING btree ("workspace_id","name");
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "project_type" text DEFAULT 'development';
--> statement-breakpoint
UPDATE "project" SET "project_type" = 'development' WHERE "project_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "project_type" SET DEFAULT 'development';
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "project_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "client_id" text;
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "client_id" DROP NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project" ADD CONSTRAINT "project_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_client_id_idx" ON "project" USING btree ("client_id");
