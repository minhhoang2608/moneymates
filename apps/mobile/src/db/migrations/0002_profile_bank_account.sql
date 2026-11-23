CREATE TABLE `bank_account` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`bank_bin` text NOT NULL,
	`bank_name` text NOT NULL,
	`account_no` text NOT NULL,
	`account_name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_account_one_default_idx` ON `bank_account` (`is_default`) WHERE "bank_account"."is_default" = 1 and "bank_account"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `bank_account_deleted_at_created_at_idx` ON `bank_account` (`deleted_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`display_name` text DEFAULT '' NOT NULL,
	`avatar_uri` text
);
