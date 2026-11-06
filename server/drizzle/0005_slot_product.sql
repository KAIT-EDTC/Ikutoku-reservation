-- コマに体験（product）を持たせる。SQLite は NOT NULL の列を既定値なしで足せないので slots を作り直す。
-- 既にあるコマは「プログラミング体験」にする（違う体験のコマは管理画面で作り直す）
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_slots` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`product` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`capacity` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	CONSTRAINT "slots_capacity" CHECK("__new_slots"."capacity" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_slots`("id", "date", "product", "start_time", "end_time", "capacity", "deleted") SELECT "id", "date", 'programming', "start_time", "end_time", "capacity", "deleted" FROM `slots`;--> statement-breakpoint
DROP TABLE `slots`;--> statement-breakpoint
ALTER TABLE `__new_slots` RENAME TO `slots`;--> statement-breakpoint
CREATE UNIQUE INDEX `slots_date_product_start_time_unique` ON `slots` (`date`,`product`,`start_time`);--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
