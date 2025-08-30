-- =================================================================
-- Setup: Ensure required tables and constraints are handled idempotently
-- =================================================================

-- Create invitation table if it doesn't exist
CREATE TABLE IF NOT EXISTS "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"team_id" text, -- This column exists from your previous snippet.
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);

-- Create team_member table if it doesn't exist
CREATE TABLE IF NOT EXISTS "team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp
);

-- Create team table if it doesn't exist
CREATE TABLE IF NOT EXISTS "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);

-- Add unique constraint for workspace_member (needed for UPSERT)
-- This needs to be done before the INSERT with ON CONFLICT.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'workspace_member_workspace_id_user_id_unique'
        AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
        AND conrelid = 'workspace_member'::regclass
    ) THEN
        ALTER TABLE "workspace_member" 
        ADD CONSTRAINT "workspace_member_workspace_id_user_id_unique" 
        UNIQUE ("workspace_id", "user_id");
    END IF;
END $$;

-- Add foreign key constraints idempotently
DO $$
BEGIN
    -- For invitation table
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'invitation_workspace_id_workspace_id_fk' AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')) THEN
        ALTER TABLE "invitation" ADD CONSTRAINT "invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'invitation_inviter_id_user_id_fk' AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')) THEN
        ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;
    END IF;
    
    -- For team tables
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'team_workspace_id_workspace_id_fk' AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')) THEN
        ALTER TABLE "team" ADD CONSTRAINT "team_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'team_member_team_id_team_id_fk' AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')) THEN
        ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'team_member_user_id_user_id_fk' AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')) THEN
        ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;
    END IF;
END $$;


-- =================================================================
-- Data Migration: Persist owners and convert pending members to invites
-- =================================================================

-- Clean up potential duplicates in workspace_member before applying unique constraint
-- This MUST run before the ON CONFLICT DML if the constraint doesn't exist yet,
-- or if it was dropped and re-added. If the constraint already exists and is enforced,
-- this step would be necessary *before* attempting to create the constraint.
-- Since we're handling constraint creation idempotently above, this DELETE is safe.
DO $$
BEGIN
    -- Check if the constraint exists before attempting the delete to avoid errors if it's already in place
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'workspace_member_workspace_id_user_id_unique' AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')) THEN
        DELETE FROM "workspace_member" 
        WHERE id NOT IN (
          SELECT DISTINCT ON (workspace_id, user_id) id
          FROM "workspace_member"
          ORDER BY workspace_id, user_id, joined_at DESC
        );
    END IF;
END $$;


-- Part A: Migrate existing workspace owners to workspace_member roles.
-- Uses ON CONFLICT to safely handle cases where an owner might already be a member.
INSERT INTO "workspace_member" (
  id,
  workspace_id,
  user_id,
  role,
  status,
  joined_at
)
SELECT
  gen_random_uuid()::text,
  w.id,
  w.owner_id,
  'owner',
  'active', -- Assuming existing owners are active members
  NOW()
FROM
  "workspace" w
WHERE
  w.owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET
  role = 'owner', -- Ensure owner role is set even if they were a different role before
  status = 'active'; -- Ensure status is active

-- Part B: Migrate existing "pending" workspace_members to the invitation table.
-- This should happen after Part A so we can correctly assign inviter_id.
INSERT INTO "invitation" (
  id,
  workspace_id,
  email,
  role,
  status,
  expires_at,
  inviter_id
)
SELECT
  gen_random_uuid()::text,
  wm.workspace_id,
  u.email,
  wm.role, -- Carry over the role if it was defined in workspace_member
  'pending',
  NOW() + INTERVAL '1 month', -- Set an expiry for the invitation
  COALESCE(
    (SELECT user_id FROM workspace_member owner WHERE owner.workspace_id = wm.workspace_id AND owner.role = 'owner' LIMIT 1),
    (SELECT id FROM "user" LIMIT 1) -- Fallback: use the first user if no owner is found for this workspace yet
  )
FROM
  "workspace_member" wm
JOIN
  "user" u ON wm.user_id = u.id
WHERE
  wm.status = 'pending'
ON CONFLICT DO NOTHING; -- Safely avoid inserting duplicates if the migration runs again


-- =================================================================
-- Schema Alterations: Add/Drop Columns and Constraints
-- =================================================================

DO $$
BEGIN
    -- Add new columns to existing tables (using IF NOT EXISTS logic with pg_attribute)
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'session'::regclass AND attname = 'active_workspace_id' AND NOT attisdropped) THEN
        ALTER TABLE "session" ADD COLUMN "active_workspace_id" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'session'::regclass AND attname = 'active_team_id' AND NOT attisdropped) THEN
        ALTER TABLE "session" ADD COLUMN "active_team_id" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'workspace'::regclass AND attname = 'slug' AND NOT attisdropped) THEN
        ALTER TABLE "workspace" ADD COLUMN "slug" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'workspace'::regclass AND attname = 'logo' AND NOT attisdropped) THEN
        ALTER TABLE "workspace" ADD COLUMN "logo" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'workspace'::regclass AND attname = 'metadata' AND NOT attisdropped) THEN
        ALTER TABLE "workspace" ADD COLUMN "metadata" text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'invitation'::regclass AND attname = 'team_id' AND NOT attisdropped) THEN
        ALTER TABLE "invitation" ADD COLUMN "team_id" text;
    END IF;

    -- Drop columns (using IF EXISTS logic with pg_attribute)
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'workspace'::regclass AND attname = 'owner_id' AND NOT attisdropped) THEN
        ALTER TABLE "workspace" DROP COLUMN "owner_id";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'workspace_member'::regclass AND attname = 'status' AND NOT attisdropped) THEN
        ALTER TABLE "workspace_member" DROP COLUMN "status";
    END IF;
END $$;

-- Add the unique constraint for workspace slug (idempotently)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'workspace_slug_unique' AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')) THEN
        ALTER TABLE "workspace" ADD CONSTRAINT "workspace_slug_unique" UNIQUE("slug");
    END IF;
END $$;