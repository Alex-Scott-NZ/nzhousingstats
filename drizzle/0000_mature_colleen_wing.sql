CREATE TABLE `location_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_date` text NOT NULL,
	`listing_type` text NOT NULL,
	`region_id` integer NOT NULL,
	`region_name` text NOT NULL,
	`district_id` integer,
	`district_name` text,
	`suburb_id` integer,
	`suburb_name` text,
	`location_type` text NOT NULL,
	`listing_count` integer,
	`collected_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_date` text NOT NULL,
	`listing_type` text NOT NULL,
	`total_nz_listings` integer NOT NULL,
	`collected_at` text NOT NULL,
	`raw_data` text NOT NULL
);
