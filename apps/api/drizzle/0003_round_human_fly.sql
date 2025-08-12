-- Clear session table since sessions can be recreated
TRUNCATE TABLE "session";
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Drop existing foreign key constraints
ALTER TABLE "activity" DROP CONSTRAINT "activity_user_email_user_email_fk";
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_user_email_user_email_fk";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_assignee_email_user_email_fk";
--> statement-breakpoint
ALTER TABLE "time_entry" DROP CONSTRAINT "time_entry_user_email_user_email_fk";
--> statement-breakpoint
ALTER TABLE "workspace" DROP CONSTRAINT "workspace_owner_email_user_email_fk";
--> statement-breakpoint
ALTER TABLE "workspace_member" DROP CONSTRAINT "workspace_member_workspace_id_workspace_id_fk";
--> statement-breakpoint
-- Add session columns for better-auth
ALTER TABLE "session" ADD COLUMN "token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "user_agent" text;--> statement-breakpoint
-- Add user columns for better-auth (nullable first)
ALTER TABLE "user" ADD COLUMN "email_verified" boolean;--> statement-breakpoint
-- Update existing users with default value
UPDATE "user" SET "email_verified" = false WHERE "email_verified" IS NULL;--> statement-breakpoint
-- Make email_verified NOT NULL
ALTER TABLE "user" ALTER COLUMN "email_verified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "image" text;--> statement-breakpoint
-- Add user updated_at column as nullable first
ALTER TABLE "user" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
-- Update existing users with default value
UPDATE "user" SET "updated_at" = NOW() WHERE "updated_at" IS NULL;--> statement-breakpoint
-- Make updated_at NOT NULL
ALTER TABLE "user" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean;--> statement-breakpoint
-- Convert activity.user_email to activity.user_id
ALTER TABLE "activity" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "activity" SET "user_id" = (
  SELECT u.id 
  FROM "user" u 
  WHERE u.email = "activity"."user_email"
) WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "activity" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" DROP COLUMN "user_email";--> statement-breakpoint
-- Convert notification.user_email to notification.user_id
ALTER TABLE "notification" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "notification" SET "user_id" = (
  SELECT u.id 
  FROM "user" u 
  WHERE u.email = "notification"."user_email"
) WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" DROP COLUMN "user_email";--> statement-breakpoint
-- Convert task.assignee_email to task.assignee_id
ALTER TABLE "task" ADD COLUMN "assignee_id" text;--> statement-breakpoint
UPDATE "task" SET "assignee_id" = (
  SELECT u.id 
  FROM "user" u 
  WHERE u.email = "task"."assignee_email"
) WHERE "assignee_email" IS NOT NULL AND "assignee_id" IS NULL;--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "assignee_email";--> statement-breakpoint
-- Convert time_entry.user_email to time_entry.user_id
ALTER TABLE "time_entry" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "time_entry" SET "user_id" = (
  SELECT u.id 
  FROM "user" u 
  WHERE u.email = "time_entry"."user_email"
) WHERE "user_email" IS NOT NULL AND "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "time_entry" DROP COLUMN "user_email";--> statement-breakpoint
-- Convert workspace.owner_email to workspace.owner_id
ALTER TABLE "workspace" ADD COLUMN "owner_id" text;--> statement-breakpoint
UPDATE "workspace" SET "owner_id" = (
  SELECT u.id 
  FROM "user" u 
  WHERE u.email = "workspace"."owner_email"
) WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "workspace" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" DROP COLUMN "owner_email";--> statement-breakpoint
-- Convert workspace_member.user_email to workspace_member.user_id
ALTER TABLE "workspace_member" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "workspace_member" SET "user_id" = (
  SELECT u.id 
  FROM "user" u 
  WHERE u.email = "workspace_member"."user_email"
) WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "workspace_member" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_member" DROP COLUMN "user_email";--> statement-breakpoint
-- Migrate existing passwords to account table before dropping user.password
INSERT INTO "account" (
  "id", 
  "account_id", 
  "provider_id", 
  "user_id", 
  "password", 
  "created_at", 
  "updated_at"
)
SELECT 
  'acc_' || substr(md5(random()::text || u.id), 1, 21) as id,
  u.email as account_id,
  'credential' as provider_id,
  u.id as user_id,
  u.password,
  NOW() as created_at,
  NOW() as updated_at
FROM "user" u 
WHERE u.password IS NOT NULL;--> statement-breakpoint
-- Add all foreign key constraints
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Drop user password column (better-auth handles this)
ALTER TABLE "user" DROP COLUMN "password";--> statement-breakpoint
-- Add unique constraints
ALTER TABLE "session" ADD CONSTRAINT "session_token_unique" UNIQUE("token");
