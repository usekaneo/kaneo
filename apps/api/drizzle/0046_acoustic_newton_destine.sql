ALTER TABLE "team_member" ADD COLUMN "membership_key" text;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_membership_key_unique" UNIQUE("membership_key");