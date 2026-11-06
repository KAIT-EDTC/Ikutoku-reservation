-- D1 は PRAGMA foreign_keys=OFF を無視するので、reservations → slots の外部キーの確認をコミット時まで遅らせて slots を作り直す
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_slots` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`capacity` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	CONSTRAINT "slots_capacity" CHECK("__new_slots"."capacity" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_slots`("id", "date", "start_time", "end_time", "capacity", "deleted") SELECT "id", "date", "start_time", "end_time", "capacity", "deleted" FROM `slots`;--> statement-breakpoint
DROP TABLE `slots`;--> statement-breakpoint
ALTER TABLE `__new_slots` RENAME TO `slots`;--> statement-breakpoint
CREATE UNIQUE INDEX `slots_date_start_time_unique` ON `slots` (`date`,`start_time`);--> statement-breakpoint
DROP TABLE `slot_templates`;--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
