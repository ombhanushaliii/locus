CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`center_lat` real NOT NULL,
	`center_lng` real NOT NULL,
	`airport_lat` real NOT NULL,
	`airport_lng` real NOT NULL,
	`airport_label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `localities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` text NOT NULL,
	`name` text NOT NULL,
	`sub_region` text,
	`character` text,
	`center_lat` real,
	`center_lng` real,
	`vp_sw_lat` real,
	`vp_sw_lng` real,
	`vp_ne_lat` real,
	`vp_ne_lng` real,
	`housing_count` integer DEFAULT 0 NOT NULL,
	`is_residential` integer DEFAULT false NOT NULL,
	`scanned_at` integer,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `localities_city_name` ON `localities` (`city_id`,`name`);--> statement-breakpoint
CREATE TABLE `locality_amenity_counts` (
	`locality_id` integer NOT NULL,
	`category` text NOT NULL,
	`count` integer NOT NULL,
	`place_ids` text DEFAULT '[]' NOT NULL,
	`points` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`locality_id`, `category`),
	FOREIGN KEY (`locality_id`) REFERENCES `localities`(`id`) ON UPDATE no action ON DELETE cascade
);
