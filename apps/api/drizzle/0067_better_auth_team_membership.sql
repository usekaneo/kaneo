ALTER TABLE "team" ADD COLUMN "member_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "membership_key" text;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_membership_key_unique" UNIQUE("membership_key");
--> statement-breakpoint
UPDATE "team" SET "member_count" = (SELECT count(*)::integer FROM "team_member" WHERE "team_member"."team_id" = "team"."id");
