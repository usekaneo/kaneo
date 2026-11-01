ALTER TABLE "agent_job" ADD COLUMN "dispatch_attempted_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_reservation" ADD COLUMN "next_reconcile_at" timestamp DEFAULT ((now() AT TIME ZONE 'utc') + interval '10 minutes') NOT NULL;--> statement-breakpoint
CREATE INDEX "ai_reservation_retry_idx" ON "ai_reservation" USING btree ("status","next_reconcile_at");