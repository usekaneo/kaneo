CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT '"2025-04-17T20:55:01.755Z"' NOT NULL,
	`user_email` text NOT NULL,
	`content` text,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text DEFAULT 'Layout',
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT '"2025-04-17T20:55:01.755Z"' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`position` integer DEFAULT 0,
	`number` integer DEFAULT 1,
	`assignee_email` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'to-do' NOT NULL,
	`priority` text DEFAULT 'low',
	`due_date` integer,
	`created_at` integer DEFAULT '"2025-04-17T20:55:01.755Z"' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`assignee_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT '"2025-04-17T20:55:01.754Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_email` text NOT NULL,
	`created_at` integer DEFAULT '"2025-04-17T20:55:01.755Z"' NOT NULL,
	FOREIGN KEY (`owner_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workspace_member` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer DEFAULT '"2025-04-17T20:55:01.755Z"' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
