CREATE TABLE IF NOT EXISTS "team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint

-- Make task_id nullable in label table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'label' 
        AND column_name = 'task_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "label" ALTER COLUMN "task_id" DROP NOT NULL;
    END IF;
END $$;
--> statement-breakpoint

-- Add team_id column to invitation table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invitation' 
        AND column_name = 'team_id'
    ) THEN
        ALTER TABLE "invitation" ADD COLUMN "team_id" text;
    END IF;
END $$;
--> statement-breakpoint

-- Add workspace_id column to label table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'label' 
        AND column_name = 'workspace_id'
    ) THEN
        -- Add column as nullable first
        ALTER TABLE "label" ADD COLUMN "workspace_id" text;
        
        -- Update existing labels with workspace_id from their associated tasks
        UPDATE "label" SET "workspace_id" = (
            SELECT p.workspace_id 
            FROM "task" t 
            JOIN "project" p ON t.project_id = p.id 
            WHERE t.id = "label"."task_id"
        ) WHERE "task_id" IS NOT NULL AND "workspace_id" IS NULL;
        
        -- For labels without task_id, we need to assign them to a default workspace
        -- or remove them. Let's assign them to the first available workspace
        UPDATE "label" SET "workspace_id" = (
            SELECT id FROM "workspace" LIMIT 1
        ) WHERE "workspace_id" IS NULL;
        
        -- Remove any labels that still don't have a workspace_id
        DELETE FROM "label" WHERE "workspace_id" IS NULL;
        
        -- Now make the column NOT NULL
        ALTER TABLE "label" ALTER COLUMN "workspace_id" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint

-- Add active_team_id column to session table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'session' 
        AND column_name = 'active_team_id'
    ) THEN
        ALTER TABLE "session" ADD COLUMN "active_team_id" text;
    END IF;
END $$;
--> statement-breakpoint
-- Add foreign key constraints idempotently
DO $$
BEGIN
    -- team_member -> team foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'team_member_team_id_team_id_fk'
        AND table_name = 'team_member'
    ) THEN
        ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" 
        FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    -- team_member -> user foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'team_member_user_id_user_id_fk'
        AND table_name = 'team_member'
    ) THEN
        ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    -- team -> workspace foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'team_workspace_id_workspace_id_fk'
        AND table_name = 'team'
    ) THEN
        ALTER TABLE "team" ADD CONSTRAINT "team_workspace_id_workspace_id_fk" 
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    -- label -> workspace foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'label_workspace_id_workspace_id_fk'
        AND table_name = 'label'
    ) THEN
        ALTER TABLE "label" ADD CONSTRAINT "label_workspace_id_workspace_id_fk" 
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;
    END IF;

    -- workspace_member unique constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workspace_member_workspace_id_user_id_unique'
        AND table_name = 'workspace_member'
    ) THEN
        ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_user_id_unique" 
        UNIQUE("workspace_id","user_id");
    END IF;
END $$;