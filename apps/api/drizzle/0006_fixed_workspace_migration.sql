-- Fixed migration to handle workspace_member.user_email to user_id conversion
-- This migration is idempotent and handles cases where columns already exist

-- Clear session table since sessions can be recreated
TRUNCATE TABLE "session";

-- Create account table if it doesn't exist
CREATE TABLE IF NOT EXISTS "account" (
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

-- Create verification table if it doesn't exist
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Drop existing foreign key constraints (idempotent)
DO $$
BEGIN
    -- Drop constraints if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_user_email_user_email_fk') THEN
        ALTER TABLE "activity" DROP CONSTRAINT "activity_user_email_user_email_fk";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_user_email_user_email_fk') THEN
        ALTER TABLE "notification" DROP CONSTRAINT "notification_user_email_user_email_fk";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_user_id_fk') THEN
        ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fk";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_assignee_email_user_email_fk') THEN
        ALTER TABLE "task" DROP CONSTRAINT "task_assignee_email_user_email_fk";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entry_user_email_user_email_fk') THEN
        ALTER TABLE "time_entry" DROP CONSTRAINT "time_entry_user_email_user_email_fk";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_owner_email_user_email_fk') THEN
        ALTER TABLE "workspace" DROP CONSTRAINT "workspace_owner_email_user_email_fk";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_member_workspace_id_workspace_id_fk') THEN
        ALTER TABLE "workspace_member" DROP CONSTRAINT "workspace_member_workspace_id_workspace_id_fk";
    END IF;
END $$;

-- Add session columns for better-auth (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'token') THEN
        ALTER TABLE "session" ADD COLUMN "token" text NOT NULL DEFAULT '';
        ALTER TABLE "session" ALTER COLUMN "token" DROP DEFAULT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'created_at') THEN
        ALTER TABLE "session" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'updated_at') THEN
        ALTER TABLE "session" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'ip_address') THEN
        ALTER TABLE "session" ADD COLUMN "ip_address" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'user_agent') THEN
        ALTER TABLE "session" ADD COLUMN "user_agent" text;
    END IF;
END $$;

-- Add user columns for better-auth (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'email_verified') THEN
        ALTER TABLE "user" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'image') THEN
        ALTER TABLE "user" ADD COLUMN "image" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'updated_at') THEN
        ALTER TABLE "user" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'is_anonymous') THEN
        ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean;
    END IF;
END $$;

-- Convert activity.user_email to activity.user_id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity' AND column_name = 'user_id') THEN
        ALTER TABLE "activity" ADD COLUMN "user_id" text;
        
        UPDATE "activity" SET "user_id" = (
          SELECT u.id 
          FROM "user" u 
          WHERE u.email = "activity"."user_email"
        ) WHERE "user_id" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity' AND column_name = 'user_email');
        
        ALTER TABLE "activity" ALTER COLUMN "user_id" SET NOT NULL;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity' AND column_name = 'user_email') THEN
            ALTER TABLE "activity" DROP COLUMN "user_email";
        END IF;
    END IF;
END $$;

-- Convert notification.user_email to notification.user_id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'user_id') THEN
        ALTER TABLE "notification" ADD COLUMN "user_id" text;
        
        UPDATE "notification" SET "user_id" = (
          SELECT u.id 
          FROM "user" u 
          WHERE u.email = "notification"."user_email"
        ) WHERE "user_id" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'user_email');
        
        ALTER TABLE "notification" ALTER COLUMN "user_id" SET NOT NULL;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'user_email') THEN
            ALTER TABLE "notification" DROP COLUMN "user_email";
        END IF;
    END IF;
END $$;

-- Convert task.assignee_email to task.assignee_id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task' AND column_name = 'assignee_id') THEN
        ALTER TABLE "task" ADD COLUMN "assignee_id" text;
        
        UPDATE "task" SET "assignee_id" = (
          SELECT u.id 
          FROM "user" u 
          WHERE u.email = "task"."assignee_email"
        ) WHERE "assignee_email" IS NOT NULL AND "assignee_id" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task' AND column_name = 'assignee_email');
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task' AND column_name = 'assignee_email') THEN
            ALTER TABLE "task" DROP COLUMN "assignee_email";
        END IF;
    END IF;
END $$;

-- Convert time_entry.user_email to time_entry.user_id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entry' AND column_name = 'user_id') THEN
        ALTER TABLE "time_entry" ADD COLUMN "user_id" text;
        
        UPDATE "time_entry" SET "user_id" = (
          SELECT u.id 
          FROM "user" u 
          WHERE u.email = "time_entry"."user_email"
        ) WHERE "user_email" IS NOT NULL AND "user_id" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entry' AND column_name = 'user_email');
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entry' AND column_name = 'user_email') THEN
            ALTER TABLE "time_entry" DROP COLUMN "user_email";
        END IF;
    END IF;
END $$;

-- Convert workspace.owner_email to workspace.owner_id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace' AND column_name = 'owner_id') THEN
        ALTER TABLE "workspace" ADD COLUMN "owner_id" text;
        
        UPDATE "workspace" SET "owner_id" = (
          SELECT u.id 
          FROM "user" u 
          WHERE u.email = "workspace"."owner_email"
        ) WHERE "owner_id" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace' AND column_name = 'owner_email');
        
        ALTER TABLE "workspace" ALTER COLUMN "owner_id" SET NOT NULL;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace' AND column_name = 'owner_email') THEN
            ALTER TABLE "workspace" DROP COLUMN "owner_email";
        END IF;
    END IF;
END $$;

-- Convert workspace_member.user_email to workspace_member.user_id (idempotent)
-- This is handled by our pre-migration script, but we include it here for completeness
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_member' AND column_name = 'user_id') THEN
        ALTER TABLE "workspace_member" ADD COLUMN "user_id" text;
    END IF;
    
    -- Only do the update if user_email column still exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_member' AND column_name = 'user_email') THEN
        UPDATE "workspace_member" SET "user_id" = (
          SELECT u.id 
          FROM "user" u 
          WHERE u.email = "workspace_member"."user_email"
        ) WHERE "user_id" IS NULL;
        
        -- Remove records that couldn't be migrated
        DELETE FROM "workspace_member" WHERE "user_id" IS NULL;
        
        ALTER TABLE "workspace_member" DROP COLUMN "user_email";
    END IF;
    
    -- Ensure user_id is NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_member' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
        -- Clean up any remaining NULL values
        DELETE FROM "workspace_member" WHERE "user_id" IS NULL;
        ALTER TABLE "workspace_member" ALTER COLUMN "user_id" SET NOT NULL;
    END IF;
END $$;

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
WHERE u.password IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM "account" a 
    WHERE a.user_id = u.id AND a.provider_id = 'credential'
);

-- Add all foreign key constraints (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_user_id_user_id_fk') THEN
        ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_user_id_user_id_fk') THEN
        ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_user_id_user_id_fk') THEN
        ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_user_id_fk') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_assignee_id_user_id_fk') THEN
        ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entry_user_id_user_id_fk') THEN
        ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_owner_id_user_id_fk') THEN
        ALTER TABLE "workspace" ADD CONSTRAINT "workspace_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_member_user_id_user_id_fk') THEN
        ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_member_workspace_id_workspace_id_fk') THEN
        ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- Drop user password column (better-auth handles this)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'password') THEN
        ALTER TABLE "user" DROP COLUMN "password";
    END IF;
END $$;

-- Add unique constraints (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_token_unique') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_token_unique" UNIQUE("token");
    END IF;
END $$;
