ALTER TABLE `tailoredResumeVersions` ADD `applicationStatus` enum('draft','ready','applied','screening','interview','offer','rejected','withdrawn') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `tailoredResumeVersions` ADD `applicationPlatform` varchar(80);--> statement-breakpoint
ALTER TABLE `tailoredResumeVersions` ADD `applicationUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `tailoredResumeVersions` ADD `appliedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tailoredResumeVersions` ADD `applicationNotes` text;--> statement-breakpoint
ALTER TABLE `tailoredResumeVersions` ADD `lastStatusAt` timestamp DEFAULT (now()) NOT NULL;