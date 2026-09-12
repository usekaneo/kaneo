ALTER TABLE "project" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "project_workspaceId_position_idx" ON "project" USING btree ("workspace_id","position");--> statement-breakpoint
UPDATE "project" p SET "position" = sub.rn
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "workspace_id" ORDER BY "created_at", "id") - 1 AS rn
	FROM "project"
) sub
WHERE p."id" = sub."id";