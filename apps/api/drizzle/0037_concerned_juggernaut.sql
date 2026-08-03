CREATE TABLE "item_type" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'SquareCheckBig' NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_type_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "item_type_workspace_key_unique" UNIQUE("workspace_id","key")
);
--> statement-breakpoint
CREATE TABLE "saved_view" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"user_id" text,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_view_scope_key_unique" UNIQUE NULLS NOT DISTINCT("workspace_id","project_id","user_id","key")
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "item_type_workspace_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "item_type_id" text;--> statement-breakpoint
ALTER TABLE "item_type" ADD CONSTRAINT "item_type_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saved_view" ADD CONSTRAINT "saved_view_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saved_view" ADD CONSTRAINT "saved_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saved_view" ADD CONSTRAINT "saved_view_workspace_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "item_type_workspaceId_idx" ON "item_type" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "saved_view_workspaceId_idx" ON "saved_view" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "saved_view_projectId_idx" ON "saved_view" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "saved_view_userId_idx" ON "saved_view" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_item_type_workspace_project_fk" FOREIGN KEY ("item_type_workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_item_type_fk" FOREIGN KEY ("item_type_workspace_id","item_type_id") REFERENCES "public"."item_type"("workspace_id","id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_itemType_idx" ON "task" USING btree ("item_type_workspace_id","item_type_id");--> statement-breakpoint
CREATE INDEX "task_itemTypeWorkspaceProject_idx" ON "task" USING btree ("item_type_workspace_id","project_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_item_type_pair_check" CHECK (("task"."item_type_workspace_id" is null) = ("task"."item_type_id" is null));