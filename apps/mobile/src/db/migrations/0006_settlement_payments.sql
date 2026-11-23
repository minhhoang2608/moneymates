CREATE TABLE `settlement_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`group_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'VND' NOT NULL,
	`direction` text NOT NULL,
	`paid_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_payments_amount_check" CHECK("settlement_payments"."amount" > 0),
	CONSTRAINT "settlement_payments_direction_check" CHECK("settlement_payments"."direction" in ('pay_to_me', 'pay_from_me'))
);
--> statement-breakpoint
CREATE INDEX `settlement_payments_group_id_deleted_at_idx` ON `settlement_payments` (`group_id`,`deleted_at`);