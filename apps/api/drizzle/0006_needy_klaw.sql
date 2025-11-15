ALTER TABLE "github_integration" ADD COLUMN "title_template" text;--> statement-breakpoint
ALTER TABLE "github_integration" ADD COLUMN "description_template" text;--> statement-breakpoint
ALTER TABLE "github_integration" ADD COLUMN "comment_template" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "linked_issue_id" text;