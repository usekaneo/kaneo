CREATE TABLE "user_task_order" (
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "user_task_order_user_id_task_id_pk" PRIMARY KEY("user_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "user_task_order" ADD CONSTRAINT "user_task_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_task_order" ADD CONSTRAINT "user_task_order_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_task_order" ADD CONSTRAINT "user_task_order_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_task_order_user_workspace_idx" ON "user_task_order" USING btree ("user_id","workspace_id");