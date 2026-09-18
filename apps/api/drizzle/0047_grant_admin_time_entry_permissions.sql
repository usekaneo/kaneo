-- New workspaces get timeEntry permissions from the admin role payload. Existing
-- admin rows predate the resource, so grant it once here; a boot-time backfill
-- would keep re-adding it after an owner deliberately removed it. Rows whose
-- permission text is not valid JSON are skipped instead of failing the upgrade.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT "id", "permission" FROM "workspace_role" WHERE "role" = 'admin' LOOP
    BEGIN
      IF NOT (r."permission"::jsonb ? 'timeEntry') THEN
        UPDATE "workspace_role"
        SET "permission" = (r."permission"::jsonb || '{"timeEntry":["read_all","manage_all"]}'::jsonb)::text
        WHERE "id" = r."id";
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping workspace_role % with unparseable permission', r."id";
    END;
  END LOOP;
END $$;
