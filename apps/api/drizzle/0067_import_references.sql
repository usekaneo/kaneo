CREATE TABLE "import_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"source" text NOT NULL,
	"entity_type" text NOT NULL,
	"source_key" text NOT NULL,
	"source_label" text,
	"source_url" text,
	"task_id" text,
	"sprint_id" text,
	"column_id" text,
	"asset_id" text,
	"activity_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "import_reference_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT "import_reference_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT "import_reference_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT "import_reference_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT "import_reference_column_id_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."column"("id") ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT "import_reference_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT "import_reference_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
ALTER TABLE "import_reference" ADD CONSTRAINT "import_reference_source_key_unique" UNIQUE("project_id","source","entity_type","source_key");--> statement-breakpoint
CREATE INDEX "import_reference_workspaceId_idx" ON "import_reference" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "import_reference_projectId_idx" ON "import_reference" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "import_reference_taskId_idx" ON "import_reference" USING btree ("task_id");