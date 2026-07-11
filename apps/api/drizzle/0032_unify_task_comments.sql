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
