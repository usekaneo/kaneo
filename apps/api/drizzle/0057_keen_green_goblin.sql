CREATE TABLE "activity_reaction" (
	"activity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "reply_to_id" text;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "activity_reaction" ADD CONSTRAINT "activity_reaction_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_reaction" ADD CONSTRAINT "activity_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_reaction_activity_user_emoji_idx" ON "activity_reaction" USING btree ("activity_id","user_id","emoji");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_reply_to_id_activity_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."activity"("id") ON DELETE set null ON UPDATE cascade;