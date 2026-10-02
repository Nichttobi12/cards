CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`collection_id` text NOT NULL,
	`card_id` text NOT NULL,
	`language` text NOT NULL,
	`variant` text NOT NULL,
	`condition` text NOT NULL,
	`quantity` integer NOT NULL,
	`cost_cents` integer,
	`manual_cents` integer,
	`grading` text NOT NULL,
	`note` text NOT NULL,
	`data` text NOT NULL,
	`fetched` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cards_owner_collection` ON `cards` (`owner`,`collection_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_collections_owner` ON `collections` (`owner`);
