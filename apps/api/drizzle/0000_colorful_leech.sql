CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text DEFAULT 'Layout',
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT '"2025-02-18T21:46:28.196Z"' NOT NULL,
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
	`number` integer DEFAULT 1,
	`assignee_email` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'to-do' NOT NULL,
	`priority` text DEFAULT 'low',
	`due_date` integer,
	`created_at` integer DEFAULT '"2025-02-18T21:46:28.196Z"' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`assignee_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT '"2025-02-18T21:46:28.196Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_email` text NOT NULL,
	`created_at` integer DEFAULT '"2025-02-18T21:46:28.196Z"' NOT NULL,
	FOREIGN KEY (`owner_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workspace_member` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer DEFAULT '"2025-02-18T21:46:28.196Z"' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_email`) REFERENCES `user`(`email`) ON UPDATE cascade ON DELETE cascade
);
