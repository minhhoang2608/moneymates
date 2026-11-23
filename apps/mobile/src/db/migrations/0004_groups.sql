CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`group_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`is_me` integer DEFAULT false NOT NULL,
	`user_id` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `group_members_group_id_deleted_at_idx` ON `group_members` (`group_id`,`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_members_one_me_idx` ON `group_members` (`group_id`) WHERE "group_members"."is_me" = 1 and "group_members"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`name` text NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`start_date` text,
	`end_date` text,
	`receiving_account_id` text,
	FOREIGN KEY (`receiving_account_id`) REFERENCES `bank_account`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "groups_dates_check" CHECK("groups"."start_date" is null or "groups"."end_date" is null or "groups"."end_date" >= "groups"."start_date")
);
--> statement-breakpoint
CREATE INDEX `groups_deleted_at_created_at_idx` ON `groups` (`deleted_at`,`created_at`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `group_id` text REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `transactions` ADD `paid_by_member_id` text REFERENCES group_members(id);--> statement-breakpoint
CREATE INDEX `transactions_group_id_deleted_at_idx` ON `transactions` (`group_id`,`deleted_at`);