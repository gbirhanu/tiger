CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`meeting_link` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`location` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`color` text DEFAULT '#ffffff' NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pomodoro_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`work_duration` integer DEFAULT 25 NOT NULL,
	`break_duration` integer DEFAULT 5 NOT NULL,
	`long_break_duration` integer DEFAULT 15 NOT NULL,
	`sessions_before_long_break` integer DEFAULT 4 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pomodoro_settings_user_id_unique` ON `pomodoro_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`completed` integer DEFAULT false NOT NULL,
	`due_date` integer,
	`priority` text DEFAULT 'medium' NOT NULL,
	`all_day` integer DEFAULT true NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurrence_pattern` text,
	`recurrence_interval` integer,
	`recurrence_end_date` integer,
	`parent_task_id` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`work_start_hour` integer DEFAULT 9 NOT NULL,
	`work_end_hour` integer DEFAULT 17 NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`default_calendar_view` text DEFAULT 'month' NOT NULL,
	`show_notifications` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);