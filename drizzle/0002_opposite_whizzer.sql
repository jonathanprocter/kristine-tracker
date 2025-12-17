CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`aiResponse` text,
	`mood` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`)
);
