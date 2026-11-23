CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	CONSTRAINT "category_type_check" CHECK("category"."type" in ('expense', 'income'))
);
--> statement-breakpoint
CREATE INDEX `category_type_deleted_at_idx` ON `category` (`type`,`deleted_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `category` (`id`, `created_at`, `updated_at`, `name`, `type`, `icon`, `color`, `is_default`) VALUES
	('813c5c60-cf5a-43a4-9b5b-dbc4f473f2fb', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Ăn uống', 'expense', 'ĂU', '#0E7C66', 1),
	('17a0b030-8539-4d91-ad37-a5d4b4950dd9', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Di chuyển', 'expense', 'DC', '#A0561A', 1),
	('8adfee2a-6290-4dd9-b646-8f57d3660dbb', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Lưu trú', 'expense', 'LT', '#5E3FA8', 1),
	('35658104-e151-489d-87a8-d913157bad5a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Mua sắm', 'expense', 'MS', '#245E94', 1),
	('8c27a2a0-4192-4a23-93aa-a71cd9448e26', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Dịch vụ', 'expense', 'DV', '#9D174D', 1),
	('f2a83ced-7c9f-4ebe-8eb6-6e7b8a3716ce', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Hóa đơn', 'expense', 'HĐ', '#7A4300', 1),
	('55e3bbc6-ec1c-4df7-b916-b47c74983534', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Giải trí', 'expense', 'GT', '#075985', 1),
	('eb3a14c0-6b13-4488-9b57-64d9b511df33', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Sức khỏe', 'expense', 'SK', '#A3161A', 1),
	('51b74b66-915b-4b45-9cbf-fc18a190ca96', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Khác', 'expense', 'K', '#4B5563', 1),
	('cc9f94b4-757a-44d6-b5a7-a684ce813082', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Lương', 'income', 'L', '#0E7C66', 1),
	('9d340fc4-e33a-4310-b637-8055cc2c0e9f', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Được trả lại', 'income', 'TL', '#0E7C66', 1),
	('33214f27-de73-43be-b3f4-92414579255b', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'Khác', 'income', 'K', '#4B5563', 1);