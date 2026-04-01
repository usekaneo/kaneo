ALTER TABLE "user_notification_workspace_project" DROP CONSTRAINT "user_notification_workspace_project_workspace_rule_id_user_notification_workspace_rule_id_fk";
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" DROP CONSTRAINT "user_notification_workspace_project_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_id_unique" UNIQUE("workspace_id","id");
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_rule" ADD CONSTRAINT "user_notification_workspace_rule_workspace_id_id_unique" UNIQUE("workspace_id","id");
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "id" text;
--> statement-breakpoint
UPDATE "user_notification_preference" SET "id" = "user_id" WHERE "id" IS NULL;
--> statement-breakpoint
ALTER TABLE "user_notification_preference" DROP CONSTRAINT "user_notification_preference_pkey";
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_pkey" PRIMARY KEY ("id");
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_unique" UNIQUE("user_id");
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
UPDATE "user_notification_workspace_project" AS unp
SET "workspace_id" = r."workspace_id"
FROM "user_notification_workspace_rule" AS r
WHERE unp."workspace_rule_id" = r."id";
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD CONSTRAINT "user_notification_workspace_project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD CONSTRAINT "user_notification_workspace_project_workspace_id_workspace_rule_id_user_notification_workspace_rule_workspace_id_id_fk" FOREIGN KEY ("workspace_id","workspace_rule_id") REFERENCES "public"."user_notification_workspace_rule"("workspace_id","id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "user_notification_workspace_project" ADD CONSTRAINT "user_notification_workspace_project_workspace_id_project_id_project_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE cascade;
