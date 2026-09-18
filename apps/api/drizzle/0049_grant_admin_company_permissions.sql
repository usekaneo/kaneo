-- Existing admin rows predate the company resources (people, activity,
-- requests, payroll, audit). Grant each missing resource once; a resource an
-- owner already configured is left as is. Unparseable rows are skipped.
DO $$
DECLARE
  r RECORD;
  grants jsonb := '{
    "people": ["read_all", "manage"],
    "activity": ["read_all"],
    "request": ["approve"],
    "payroll": ["read", "manage"],
    "audit": ["read"]
  }'::jsonb;
  current jsonb;
  key text;
BEGIN
  FOR r IN SELECT "id", "permission" FROM "workspace_role" WHERE "role" = 'admin' LOOP
    BEGIN
      current := r."permission"::jsonb;
      FOR key IN SELECT jsonb_object_keys(grants) LOOP
        IF NOT (current ? key) THEN
          current := current || jsonb_build_object(key, grants -> key);
        END IF;
      END LOOP;
      UPDATE "workspace_role" SET "permission" = current::text WHERE "id" = r."id";
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping workspace_role % with unparseable permission', r."id";
    END;
  END LOOP;
END $$;
