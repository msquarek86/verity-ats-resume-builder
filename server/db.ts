import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, masterResumes, MasterResume, tailoredResumeVersions, TailoredResumeVersion, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.role = values.role;
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createMasterResume(input: { userId: number; label: string; sourceFileName?: string; sourceText: string; structuredData: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(masterResumes).values(input);
  return Number(result[0].insertId);
}

export async function listMasterResumes(userId: number): Promise<MasterResume[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(masterResumes).where(eq(masterResumes.userId, userId)).orderBy(desc(masterResumes.updatedAt));
}

export async function createTailoredVersion(input: { userId: number; masterResumeId: number; label: string; targetRole: string; targetCompany?: string; jobDescription: string; settings: unknown; analysis: unknown; qualityGate: unknown; resumeText: string; applicationStatus?: TailoredResumeVersion["applicationStatus"]; applicationPlatform?: string; applicationUrl?: string; appliedAt?: Date; applicationNotes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(tailoredResumeVersions).values(input);
  return Number(result[0].insertId);
}

export async function listTailoredVersions(userId: number): Promise<TailoredResumeVersion[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tailoredResumeVersions).where(eq(tailoredResumeVersions.userId, userId)).orderBy(desc(tailoredResumeVersions.updatedAt));
}

export async function updateTailoredVersionApplication(input: { userId: number; versionId: number; applicationStatus: TailoredResumeVersion["applicationStatus"]; applicationPlatform?: string | null; applicationUrl?: string | null; appliedAt?: Date | null; applicationNotes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(tailoredResumeVersions).set({
    applicationStatus: input.applicationStatus,
    applicationPlatform: input.applicationPlatform ?? null,
    applicationUrl: input.applicationUrl ?? null,
    appliedAt: input.appliedAt ?? null,
    applicationNotes: input.applicationNotes ?? null,
    lastStatusAt: new Date(),
  }).where(and(eq(tailoredResumeVersions.id, input.versionId), eq(tailoredResumeVersions.userId, input.userId)));
  const result = await db.select().from(tailoredResumeVersions).where(and(eq(tailoredResumeVersions.id, input.versionId), eq(tailoredResumeVersions.userId, input.userId))).limit(1);
  if (!result[0]) throw new Error("Tailored version not found");
  return result[0];
}
