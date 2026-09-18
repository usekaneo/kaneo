ALTER TABLE "agent_device" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "attendance_session" ADD COLUMN "clock_out_source" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "auto_clock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "auto_clock_idle_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "auto_clock_offline_minutes" integer DEFAULT 10 NOT NULL;