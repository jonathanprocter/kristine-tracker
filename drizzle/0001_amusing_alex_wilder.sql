CREATE TABLE `accommodations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`loggedAt` timestamp NOT NULL,
	`timeOfDay` varchar(10) NOT NULL,
	`whatDid` text NOT NULL,
	`couldHeDoIt` enum('yes','no','maybe') NOT NULL,
	`whatFelt` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accommodations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`anxietyLevel` int NOT NULL,
	`guiltLevel` int NOT NULL,
	`activityDescription` text,
	`observationAboutBrian` text,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loginActivity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`loggedInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loginActivity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`question1Answer` text,
	`question2Answer` text,
	`question3Answer` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reflections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekNumber` int NOT NULL,
	`taskName` varchar(255) NOT NULL,
	`taskDescription` text NOT NULL,
	`goalDays` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `currentWeek` int DEFAULT 1 NOT NULL;