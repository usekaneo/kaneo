-- Imports in older versions allocated task numbers without advancing the
-- project counter. Preserve every existing number and raise only stale counters.
UPDATE "project" AS p
SET "last_task_number" = greatest(p."last_task_number", counts.max_number)
FROM (
  SELECT "project_id", max("number") AS max_number
  FROM "task"
  GROUP BY "project_id"
) AS counts
WHERE p."id" = counts."project_id"
  AND p."last_task_number" < counts.max_number;
