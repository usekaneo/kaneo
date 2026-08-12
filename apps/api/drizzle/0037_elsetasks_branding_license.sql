CREATE TABLE "instance_branding" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'ElseTasks' NOT NULL,
	"logo_url" text,
	"logo_dark_url" text,
	"favicon_url" text,
	"primary_color" text DEFAULT '#0F766E' NOT NULL,
	"accent_color" text,
	"setup_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_key" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"sku" text NOT NULL,
	"status" text DEFAULT 'unused' NOT NULL,
	"customer_email" text,
	"activated_at" timestamp,
	"expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "license_key_key_uidx" ON "license_key" USING btree ("key");
--> statement-breakpoint
CREATE TABLE "instance_license" (
	"id" text PRIMARY KEY NOT NULL,
	"license_key_id" text,
	"key" text NOT NULL,
	"sku" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instance_license" ADD CONSTRAINT "instance_license_license_key_id_license_key_id_fk" FOREIGN KEY ("license_key_id") REFERENCES "public"."license_key"("id") ON DELETE set null ON UPDATE no action;
