CREATE TABLE "chat_reaction" (
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "reply_to_id" text;--> statement-breakpoint
ALTER TABLE "chat_reaction" ADD CONSTRAINT "chat_reaction_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_reaction" ADD CONSTRAINT "chat_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_reaction_message_user_emoji_idx" ON "chat_reaction" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_reply_to_id_chat_message_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE cascade;