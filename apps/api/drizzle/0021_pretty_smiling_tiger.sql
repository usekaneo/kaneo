ALTER TABLE "activity" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "label" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_task_id_idx" ON "activity" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "label_task_id_idx" ON "label" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "label_workspace_id_idx" ON "label" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_projectId_idx" ON "task" USING btree ("project_id");--> statement-breakpoint
WITH numbered AS (
	SELECT
		id,
		project_id,
		number,
		ROW_NUMBER() OVER (
			PARTITION BY project_id, number
			ORDER BY created_at ASC, id ASC
		) AS dup_rank
	FROM task
),
to_reassign AS (
	SELECT n.id, n.project_id
	FROM numbered n
	WHERE n.dup_rank > 1
),
max_per_project AS (
	SELECT project_id, MAX(number) AS max_num
	FROM task
	GROUP BY project_id
),
new_numbers AS (
	SELECT
		tr.id,
		(mpp.max_num + ROW_NUMBER() OVER (PARTITION BY tr.project_id ORDER BY tr.id))::integer AS new_number
	FROM to_reassign tr
	JOIN max_per_project mpp ON mpp.project_id = tr.project_id
)
UPDATE task t
SET number = nn.new_number
FROM new_numbers nn
WHERE t.id = nn.id;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_number_unique" UNIQUE("project_id","number");
