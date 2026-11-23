CREATE TABLE `expense_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`transaction_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount` integer NOT NULL,
	`value` integer,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "expense_shares_amount_check" CHECK("expense_shares"."amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `expense_shares_transaction_id_deleted_at_idx` ON `expense_shares` (`transaction_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `expense_shares_member_id_deleted_at_idx` ON `expense_shares` (`member_id`,`deleted_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'VND' NOT NULL,
	`category_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`occurred_at` text NOT NULL,
	`money_source` text DEFAULT 'Tiền mặt' NOT NULL,
	`photo_uri` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`qr_data` text,
	`group_id` text,
	`paid_by_member_id` text,
	`split_mode` text,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paid_by_member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_amount_check" CHECK("__new_transactions"."amount" > 0),
	CONSTRAINT "transactions_type_check" CHECK("__new_transactions"."type" in ('expense', 'income')),
	CONSTRAINT "transactions_source_check" CHECK("__new_transactions"."source" in ('manual', 'qr', 'voice', 'bill')),
	CONSTRAINT "transactions_split_mode_check" CHECK("__new_transactions"."split_mode" is null or "__new_transactions"."split_mode" in ('equal', 'amount', 'percent'))
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "created_at", "updated_at", "deleted_at", "owner_id", "type", "amount", "currency", "category_id", "note", "occurred_at", "money_source", "photo_uri", "source", "qr_data", "group_id", "paid_by_member_id") SELECT "id", "created_at", "updated_at", "deleted_at", "owner_id", "type", "amount", "currency", "category_id", "note", "occurred_at", "money_source", "photo_uri", "source", "qr_data", "group_id", "paid_by_member_id" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `transactions_deleted_at_occurred_at_idx` ON `transactions` (`deleted_at`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `transactions_category_id_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_group_id_deleted_at_idx` ON `transactions` (`group_id`,`deleted_at`);