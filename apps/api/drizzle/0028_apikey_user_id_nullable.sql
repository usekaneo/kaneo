-- Better Auth @better-auth/api-key sets reference_id but not user_id on create.
ALTER TABLE "apikey" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
