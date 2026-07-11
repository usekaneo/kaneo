INSERT INTO "activity" (
	"id",
	"task_id",
	"type",
	"created_at",
	"updated_at",
	"user_id",
	"content"
)
SELECT
	"id",
	"task_id",
	'comment',
	"created_at",
	"updated_at",
	"user_id",
	"content"
FROM "comment"
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "comment" AS "legacy"
USING "activity" AS "migrated"
WHERE "migrated"."id" = "legacy"."id"
	AND "migrated"."task_id" = "legacy"."task_id"
	AND "migrated"."type" = 'comment'
	AND "migrated"."user_id" IS NOT DISTINCT FROM "legacy"."user_id"
	AND "migrated"."content" IS NOT DISTINCT FROM "legacy"."content"
	AND "migrated"."created_at" = "legacy"."created_at"
	AND "migrated"."updated_at" = "legacy"."updated_at";
