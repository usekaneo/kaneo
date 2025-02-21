PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text DEFAULT 'Layout',
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT '"2025-02-18T21:46:39.855Z"' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "workspace_id", "slug", "icon", "name", "description", "created_at") SELECT "id", "workspace_id", "slug", "icon", "name", "description", "created_at" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`number` integer DEFAULT 1,
	`assignee_email` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'to-do' NOT NULL,
	`priority` text DEFAULT 'low',
	`due_date` integer,
	`created_at` integer DEFAULT '"2025-02-18T21:46:39.856Z"' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`assignee_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_task`("id", "project_id", "number", "assignee_email", "title", "description", "status", "priority", "due_date", "created_at") SELECT "id", "project_id", "number", "assignee_email", "title", "description", "status", "priority", "due_date", "created_at" FROM `task`;--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
ALTER TABLE `__new_task` RENAME TO `task`;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT '"2025-02-18T21:46:39.855Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "password", "email", "created_at") SELECT "id", "name", "password", "email", "created_at" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `__new_workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_email` text NOT NULL,
	`created_at` integer DEFAULT '"2025-02-18T21:46:39.855Z"' NOT NULL,
	FOREIGN KEY (`owner_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_workspace`("id", "name", "description", "owner_email", "created_at") SELECT "id", "name", "description", "owner_email", "created_at" FROM `workspace`;--> statement-breakpoint
DROP TABLE `workspace`;--> statement-breakpoint
ALTER TABLE `__new_workspace` RENAME TO `workspace`;--> statement-breakpoint
CREATE TABLE `__new_workspace_member` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer DEFAULT '"2025-02-18T21:46:39.855Z"' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_workspace_member`("id", "workspace_id", "user_email", "role", "joined_at", "status") SELECT "id", "workspace_id", "user_email", "role", "joined_at", "status" FROM `workspace_member`;--> statement-breakpoint
DROP TABLE `workspace_member`;--> statement-breakpoint
ALTER TABLE `__new_workspace_member` RENAME TO `workspace_member`;