CREATE TABLE "pinned_label" (
	"user_id" text NOT NULL,
	"label_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "pinned_label_user_id_label_id_pk" PRIMARY KEY("user_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "project_default_label" (
	"project_id" text NOT NULL,
	"label_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "project_default_label_project_id_label_id_pk" PRIMARY KEY("project_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "pinned_label" ADD CONSTRAINT "pinned_label_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pinned_label" ADD CONSTRAINT "pinned_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_default_label" ADD CONSTRAINT "project_default_label_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_default_label" ADD CONSTRAINT "project_default_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "pinned_label_label_id_idx" ON "pinned_label" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "project_default_label_label_id_idx" ON "project_default_label" USING btree ("label_id");