CREATE TABLE `portfolio_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`scope` text NOT NULL,
	`day` text NOT NULL,
	`total_cents` integer NOT NULL,
	`card_count` integer NOT NULL,
	`valued_count` integer NOT NULL,
	`failed` integer NOT NULL,
	`captured` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_owner_scope_day` ON `portfolio_snapshots` (`owner`,`scope`,`day`);
