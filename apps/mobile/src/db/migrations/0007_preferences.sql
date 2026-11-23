CREATE TABLE `money_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	CONSTRAINT "money_sources_kind_check" CHECK("money_sources"."kind" in ('cash', 'bank', 'wallet', 'card'))
);
--> statement-breakpoint
CREATE INDEX `money_sources_deleted_at_created_at_idx` ON `money_sources` (`deleted_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_app_prefs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`app_key` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_app_prefs_app_key_idx` ON `payment_app_prefs` (`app_key`) WHERE "payment_app_prefs"."deleted_at" is null;
--> statement-breakpoint
INSERT OR IGNORE INTO `money_sources` (`id`, `created_at`, `updated_at`, `name`, `kind`, `is_default`) VALUES
	('5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Tiền mặt', 'cash', 1),
	('5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d02', '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:01.000Z', 'Ngân hàng', 'bank', 1),
	('5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d03', '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:02.000Z', 'Ví điện tử', 'wallet', 1),
	('5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d04', '2026-01-01T00:00:03.000Z', '2026-01-01T00:00:03.000Z', 'Thẻ', 'card', 1);
