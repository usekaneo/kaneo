CREATE TABLE "label_deletion" (
	"id" text PRIMARY KEY NOT NULL,
	"deletion_id" text NOT NULL,
	"user_id" text NOT NULL,
	"pending_effects" text[] DEFAULT ARRAY['github', 'gitea', 'gitlab', 'event']::text[] NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deletion_started_at" timestamp,
	"task_id" text,
	"workspace_id" text
);
--> statement-breakpoint
ALTER TABLE "label_deletion" ADD CONSTRAINT "label_deletion_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "label_deletion" ADD CONSTRAINT "label_deletion_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "label_deletion_deletion_id_idx" ON "label_deletion" USING btree ("deletion_id");--> statement-breakpoint
CREATE INDEX "label_deletion_task_id_idx" ON "label_deletion" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "label_deletion_workspace_id_idx" ON "label_deletion" USING btree ("workspace_id");
--> statement-breakpoint
-- A pending deletion reserves the provider identity (task, label name), even
-- after the label row is gone. Enforce this for every writer, including bulk
-- edits, renames, imports and webhooks. The lock is transaction scoped and no
-- connection is retained while the deletion's remote effects are processed.
CREATE FUNCTION guard_pending_label_deletion() RETURNS trigger AS $$
DECLARE
  root_deletion_started_at timestamp;
BEGIN
  IF NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Deletion takes this lock before DELETE as well, so an INSERT cannot pass
  -- the check between deleting the assignment and saving its pending effects.
  PERFORM id FROM task WHERE id = NEW.task_id FOR NO KEY UPDATE;

  IF TG_TABLE_NAME = 'label' THEN
    -- Hold the root through assignment commit. A deletion transition must wait
    -- for this assignment, or the assignment must observe the marked root.
    SELECT deletion_started_at INTO root_deletion_started_at
      FROM label
      WHERE workspace_id = NEW.workspace_id AND name = NEW.name AND task_id IS NULL
      FOR SHARE;
    IF root_deletion_started_at IS NOT NULL THEN
      RAISE EXCEPTION 'This workspace label is being deleted; finish its deletion before assigning it again'
        USING ERRCODE = '23514', CONSTRAINT = 'label_assignment_pending_deletion';
    END IF;
    IF EXISTS (
      SELECT 1 FROM label_deletion
      WHERE task_id = NEW.task_id AND name = NEW.name
    ) THEN
      RAISE EXCEPTION 'This label is being deleted; finish its deletion before assigning it again'
        USING ERRCODE = '23514', CONSTRAINT = 'label_assignment_pending_deletion';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM label WHERE task_id = NEW.task_id AND name = NEW.name
    ) THEN
      RAISE EXCEPTION 'Cannot reserve a label deletion while the label is assigned'
        USING ERRCODE = '23514', CONSTRAINT = 'label_assignment_pending_deletion';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER label_pending_deletion_guard
  BEFORE INSERT OR UPDATE OF task_id, name, workspace_id ON label
  FOR EACH ROW EXECUTE FUNCTION guard_pending_label_deletion();
--> statement-breakpoint
CREATE TRIGGER label_deletion_assignment_guard
  BEFORE INSERT OR UPDATE OF task_id, name ON label_deletion
  FOR EACH ROW EXECUTE FUNCTION guard_pending_label_deletion();
