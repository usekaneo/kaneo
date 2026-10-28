CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'instance' NOT NULL,
	"instance_name" text,
	"registration_enabled" boolean DEFAULT true NOT NULL,
	"password_registration_enabled" boolean DEFAULT true NOT NULL,
	"require_email_verification" boolean DEFAULT false NOT NULL,
	"default_role_id" text,
	"workspace_creation_restricted" boolean DEFAULT false NOT NULL,
	"disabled_integrations" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_verification_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_default_role_id_instance_role_id_fk" FOREIGN KEY ("default_role_id") REFERENCES "public"."instance_role"("id") ON DELETE restrict ON UPDATE no action;