CREATE TABLE "global_board_order" (
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"position" double precision NOT NULL,
	CONSTRAINT "global_board_order_user_id_task_id_pk" PRIMARY KEY("user_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "global_board_order" ADD CONSTRAINT "global_board_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "global_board_order" ADD CONSTRAINT "global_board_order_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "global_board_order_task_id_idx" ON "global_board_order" USING btree ("task_id");