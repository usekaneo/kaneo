CREATE TABLE "chat_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"dm_key" text,
	"created_by" text,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_member" (
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text,
	"body" text NOT NULL,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_member" ADD CONSTRAINT "chat_member_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_member" ADD CONSTRAINT "chat_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chat_conversation_workspace_idx" ON "chat_conversation" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversation_workspace_dm_key_idx" ON "chat_conversation" USING btree ("workspace_id","dm_key");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_member_conversation_user_idx" ON "chat_member" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "chat_member_user_idx" ON "chat_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_conversation_created_idx" ON "chat_message" USING btree ("conversation_id","created_at");