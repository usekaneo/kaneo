CREATE TABLE "mcp_oauth_state" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_oauth_state_kind_key_uidx" ON "mcp_oauth_state" USING btree ("kind","key");--> statement-breakpoint
CREATE INDEX "mcp_oauth_state_expiresAt_idx" ON "mcp_oauth_state" USING btree ("expires_at");