ALTER TABLE "session" ADD COLUMN "oidc_sid" text;--> statement-breakpoint
CREATE INDEX "session_oidcSid_idx" ON "session" USING btree ("oidc_sid");