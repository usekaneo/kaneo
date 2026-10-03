ALTER TABLE "agent_effect" ADD COLUMN "sequence" serial NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "cost_usd" text;--> statement-breakpoint
ALTER TABLE "agent_effect" ADD CONSTRAINT "agent_effect_sequence_unique" UNIQUE("sequence");