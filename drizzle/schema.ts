import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const masterResumes = mysqlTable("masterResumes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  sourceFileName: varchar("sourceFileName", { length: 255 }),
  sourceText: text("sourceText").notNull(),
  structuredData: json("structuredData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tailoredResumeVersions = mysqlTable("tailoredResumeVersions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  masterResumeId: int("masterResumeId").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  targetRole: varchar("targetRole", { length: 160 }).notNull(),
  targetCompany: varchar("targetCompany", { length: 160 }),
  jobDescription: text("jobDescription").notNull(),
  settings: json("settings"),
  analysis: json("analysis"),
  qualityGate: json("qualityGate"),
  resumeText: text("resumeText").notNull(),
  exportedAt: timestamp("exportedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MasterResume = typeof masterResumes.$inferSelect;
export type TailoredResumeVersion = typeof tailoredResumeVersions.$inferSelect;
