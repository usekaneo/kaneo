-- task.completed_at follows the task's column: set when it enters a final
-- column (kept when it moves between final columns), cleared when it leaves.
-- A trigger keeps every code path that moves tasks, now and later, honest.
-- Tasks without a column fall back to the "done" status slug.
CREATE OR REPLACE FUNCTION kaneo_task_completed_at() RETURNS trigger AS $$
DECLARE
  is_done boolean;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.column_id IS NOT DISTINCT FROM OLD.column_id
    AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.column_id IS NOT NULL THEN
    SELECT "is_final" INTO is_done FROM "column" WHERE "id" = NEW.column_id;
  ELSE
    is_done := NEW.status = 'done';
  END IF;

  IF coalesce(is_done, false) THEN
    IF TG_OP = 'INSERT' OR OLD.completed_at IS NULL THEN
      -- Timestamps are stored as naive UTC.
      NEW.completed_at := coalesce(NEW.completed_at, now() AT TIME ZONE 'utc');
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS task_completed_at ON "task";
--> statement-breakpoint
CREATE TRIGGER task_completed_at
  BEFORE INSERT OR UPDATE OF column_id, status ON "task"
  FOR EACH ROW EXECUTE FUNCTION kaneo_task_completed_at();
--> statement-breakpoint
-- Existing finished tasks: the last time they moved, or failing that their
-- last update. Touching completed_at alone doesn't fire the trigger.
UPDATE "task" AS t
SET "completed_at" = coalesce(
  (
    SELECT max(a."created_at")
    FROM "activity" AS a
    WHERE a."task_id" = t."id" AND a."type" IN ('status_changed', 'moved')
  ),
  t."updated_at"
)
WHERE t."completed_at" IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM "column" AS c
      WHERE c."id" = t."column_id" AND c."is_final" = true
    )
    OR (t."column_id" IS NULL AND t."status" = 'done')
  );
--> statement-breakpoint
-- The report resource is new. Give the built-in roles their defaults once;
-- a role whose owner already set report permissions is left alone, and
-- unparseable rows are skipped rather than failing the upgrade.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT "id", "permission" FROM "workspace_role"
    WHERE "role" IN ('manager', 'admin')
  LOOP
    BEGIN
      IF NOT (r."permission"::jsonb ? 'report') THEN
        UPDATE "workspace_role"
        SET "permission" = (r."permission"::jsonb || '{"report": ["read"]}'::jsonb)::text
        WHERE "id" = r."id";
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping workspace_role % with unparseable permission', r."id";
    END;
  END LOOP;
END $$;
