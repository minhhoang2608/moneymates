CREATE TABLE `transactions` (
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
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_amount_check" CHECK("transactions"."amount" > 0),
	CONSTRAINT "transactions_type_check" CHECK("transactions"."type" in ('expense', 'income')),
	CONSTRAINT "transactions_source_check" CHECK("transactions"."source" in ('manual', 'qr', 'voice', 'bill'))
);
--> statement-breakpoint
CREATE INDEX `transactions_deleted_at_occurred_at_idx` ON `transactions` (`deleted_at`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `transactions_category_id_idx` ON `transactions` (`category_id`);