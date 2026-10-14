CREATE TABLE `admins` (
	`id` integer PRIMARY KEY NOT NULL,
	`login_id` text NOT NULL,
	`totp_secret` text,
	`totp_last_step` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_login_id_unique` ON `admins` (`login_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` integer,
	`action` text NOT NULL,
	`target_id` integer
);
--> statement-breakpoint
CREATE INDEX `audit_logs_action_at` ON `audit_logs` (`action`,`at`);--> statement-breakpoint
CREATE TABLE `blackout_rules` (
	`id` integer PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`date_from` text,
	`date_to` text,
	`weekday` integer,
	`nth` integer,
	`time_from` text,
	`time_to` text,
	`slot_id` integer,
	`memo` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_token_hash_unique` ON `devices` (`token_hash`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` integer PRIMARY KEY NOT NULL,
	`slot_id` integer NOT NULL,
	`people` integer NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`created_by_type` text NOT NULL,
	`created_by_id` integer NOT NULL,
	`cancelled_at` text,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reservations_people" CHECK("reservations"."people" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_code_unique` ON `reservations` (`code`);--> statement-breakpoint
CREATE INDEX `reservations_slot` ON `reservations` (`slot_id`,`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`open_date` text NOT NULL,
	`close_date` text NOT NULL,
	`max_people` integer DEFAULT 5 NOT NULL,
	`reset_seconds` integer DEFAULT 60 NOT NULL,
	`notice` text DEFAULT '' NOT NULL,
	CONSTRAINT "settings_single_row" CHECK("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `slot_templates` (
	`id` integer PRIMARY KEY NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`capacity` integer NOT NULL,
	`valid_from` text,
	`valid_to` text,
	CONSTRAINT "slot_templates_weekday" CHECK("slot_templates"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "slot_templates_capacity" CHECK("slot_templates"."capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE `slots` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`capacity` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`template_id` integer,
	FOREIGN KEY (`template_id`) REFERENCES `slot_templates`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "slots_capacity" CHECK("slots"."capacity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_date_start_time_unique` ON `slots` (`date`,`start_time`);