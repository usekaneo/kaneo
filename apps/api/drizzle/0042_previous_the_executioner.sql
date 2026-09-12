UPDATE "task" SET "priority" = 'low' WHERE "priority" IS NULL;--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "priority" SET NOT NULL;
