-- Rename active_workspace_id to active_organization_id in session table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'session' 
        AND column_name = 'active_workspace_id'
    ) THEN
        ALTER TABLE "session" RENAME COLUMN "active_workspace_id" TO "active_organization_id";
    END IF;
END $$;


