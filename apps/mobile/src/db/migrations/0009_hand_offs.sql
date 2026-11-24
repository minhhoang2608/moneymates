CREATE TABLE `hand_offs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`transaction_id` text NOT NULL,
	`app_id` text NOT NULL,
	`method` text NOT NULL,
	`qr_asset_id` text,
	`started_at` text NOT NULL,
	`returned_at` text,
	`paid_signal` text,
	`qr_deleted_at` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "hand_offs_method_check" CHECK("hand_offs"."method" in ('autofill', 'share', 'gallery', 'paste')),
	CONSTRAINT "hand_offs_paid_signal_check" CHECK("hand_offs"."paid_signal" is null or "hand_offs"."paid_signal" in ('time', 'notification', 'receipt'))
);
--> statement-breakpoint
CREATE INDEX `hand_offs_transaction_id_idx` ON `hand_offs` (`transaction_id`);