ALTER TABLE "github_integration" ADD COLUMN "title_template" text;--> statement-breakpoint
ALTER TABLE "github_integration" ADD COLUMN "description_template" text;--> statement-breakpoint
ALTER TABLE "github_integration" ADD COLUMN "comment_template" text DEFAULT '🎯 **Task created** - {title}
<details>
<summary>Task Details</summary>

- **Task ID:** {taskId}
- **Priority:** {priority}
- **Status:** {status}


*This issue is automatically synchronized with your Kaneo project.*
</details>';--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "linked_issue_id" text;