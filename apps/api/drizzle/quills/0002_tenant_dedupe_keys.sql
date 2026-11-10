DROP INDEX "quills"."conversation_messages_email_message_id_idx";--> statement-breakpoint
DROP INDEX "quills"."conversation_messages_github_comment_id_idx";--> statement-breakpoint
DROP INDEX "quills"."conversation_messages_inbound_delivery_key_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_email_message_id_idx" ON "quills"."conversation_messages" USING btree ("workspace_id",(metadata ->> 'emailMessageId')) WHERE (metadata ->> 'emailMessageId') IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_github_comment_id_idx" ON "quills"."conversation_messages" USING btree ("workspace_id",(metadata ->> 'githubCommentId')) WHERE (metadata ->> 'githubCommentId') IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_inbound_delivery_key_idx" ON "quills"."conversation_messages" USING btree ("workspace_id","ticket_id",(metadata ->> 'inboundDeliveryKey')) WHERE (metadata ->> 'inboundDeliveryKey') IS NOT NULL;