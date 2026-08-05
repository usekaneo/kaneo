CREATE TABLE "mcp_oauth_authorization_request" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"code_challenge" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"state" text,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_client" (
	"id" text PRIMARY KEY NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"name" text,
	"issued_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_code" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code_challenge" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_oauth_authorization_request" ADD CONSTRAINT "mcp_oauth_authorization_request_client_id_mcp_oauth_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_client_id_mcp_oauth_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_oauth_authorization_request_expires_at_idx" ON "mcp_oauth_authorization_request" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mcp_oauth_code_expires_at_idx" ON "mcp_oauth_code" USING btree ("expires_at");