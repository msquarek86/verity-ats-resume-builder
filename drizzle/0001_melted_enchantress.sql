CREATE TABLE `masterResumes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`sourceFileName` varchar(255),
	`sourceText` text NOT NULL,
	`structuredData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `masterResumes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tailoredResumeVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`masterResumeId` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`targetRole` varchar(160) NOT NULL,
	`targetCompany` varchar(160),
	`jobDescription` text NOT NULL,
	`settings` json,
	`analysis` json,
	`qualityGate` json,
	`resumeText` text NOT NULL,
	`exportedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tailoredResumeVersions_id` PRIMARY KEY(`id`)
);
