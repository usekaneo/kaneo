-- The file resource is new. Give the built-in roles their defaults once;
-- a role whose owner already set file permissions is left alone, and
-- unparseable rows are skipped rather than failing the upgrade.
DO $$
DECLARE
  r RECORD;
  grants jsonb;
BEGIN
  FOR r IN
    SELECT "id", "role", "permission" FROM "workspace_role"
    WHERE "role" IN ('member', 'manager', 'admin')
  LOOP
    BEGIN
      grants := CASE r."role"
        WHEN 'admin' THEN '{"file": ["upload", "manage"]}'::jsonb
        ELSE '{"file": ["upload"]}'::jsonb
      END;
      IF NOT (r."permission"::jsonb ? 'file') THEN
        UPDATE "workspace_role"
        SET "permission" = (r."permission"::jsonb || grants)::text
        WHERE "id" = r."id";
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping workspace_role % with unparseable permission', r."id";
    END;
  END LOOP;
END $$;
