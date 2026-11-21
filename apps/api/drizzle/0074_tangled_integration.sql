CREATE TABLE "tangled_integration_state" (
	"integration_id" text PRIMARY KEY NOT NULL,
	"event_type" text,
	"outcome" text,
	"code" text,
	"ref" text,
	"checked_at" timestamp,
	"last_scan_at" timestamp,
	"scan_offset" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tangled_task_ownership" (
	"task_id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"status_revision" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "status_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tangled_integration_state" ADD CONSTRAINT "tangled_integration_state_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tangled_task_ownership" ADD CONSTRAINT "tangled_task_ownership_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tangled_task_ownership" ADD CONSTRAINT "tangled_task_ownership_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE FUNCTION "increment_task_status_revision"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.column_id IS DISTINCT FROM OLD.column_id THEN
    NEW.status_revision := OLD.status_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "task_status_revision_trigger" BEFORE UPDATE OF "status", "column_id" ON "task"
FOR EACH ROW EXECUTE FUNCTION "increment_task_status_revision"();