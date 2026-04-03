DELETE FROM "activity" a
USING "activity" b
WHERE a.ctid < b.ctid
  AND a.task_id = b.task_id
  AND a.external_source = b.external_source
  AND a.external_url = b.external_url
  AND a.external_url IS NOT NULL;

DELETE FROM "label" a
USING "label" b
WHERE a.ctid < b.ctid
  AND a.task_id = b.task_id
  AND a.name = b.name
  AND a.task_id IS NOT NULL;

DELETE FROM "label" a
USING "label" b
WHERE a.ctid < b.ctid
  AND a.workspace_id = b.workspace_id
  AND a.name = b.name
  AND a.task_id IS NULL
  AND b.task_id IS NULL
  AND a.workspace_id IS NOT NULL;

ALTER TABLE "activity"
  ADD CONSTRAINT "activity_task_external_source_external_url_unique"
  UNIQUE ("task_id", "external_source", "external_url");

ALTER TABLE "label"
  ADD CONSTRAINT "label_task_name_unique"
  UNIQUE ("task_id", "name");

CREATE UNIQUE INDEX "label_workspace_name_unique"
  ON "label" ("workspace_id", "name")
  WHERE "task_id" IS NULL;
