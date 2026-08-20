import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createMasterResume, createTailoredVersion, listMasterResumes, listTailoredVersions, updateTailoredVersionApplication } from "./db";
import { analyzeResumeForJob } from "./resumeAi";

const settingsSchema = z.object({
  targetRole: z.string().max(160).optional(),
  targetCompany: z.string().max(160).optional(),
  tone: z.enum(["concise", "confident", "executive"]).optional(),
  seniority: z.enum(["entry", "mid", "senior", "executive"]).optional(),
  pageLength: z.enum(["one", "two"]).optional(),
  template: z.enum(["classic", "modern", "technical", "minimal"]).optional(),
  optimizationLevel: z.enum(["balanced", "focused", "maximum"]).optional(),
  includeSummary: z.boolean().optional(),
  includeProjects: z.boolean().optional(),
  includeCertifications: z.boolean().optional(),
  strictTruthMode: z.boolean().optional(),
});

const analyzeInput = z.object({
  resumeText: z.string().trim().min(80, "Paste or upload a fuller resume before analysis.").max(120_000),
  jobDescription: z.string().trim().min(80, "Paste a fuller job description before analysis.").max(120_000),
  settings: settingsSchema.optional(),
});

const applicationStatusSchema = z.enum(["draft", "ready", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  resume: router({
    analyze: publicProcedure.input(analyzeInput).mutation(({ input }) => analyzeResumeForJob(input)),
    saveMaster: protectedProcedure.input(z.object({ label: z.string().trim().min(2).max(160), sourceFileName: z.string().max(255).optional(), sourceText: z.string().min(80).max(120_000), structuredData: z.unknown() })).mutation(async ({ ctx, input }) => ({ id: await createMasterResume({ ...input, userId: ctx.user.id }) })),
    listMasters: protectedProcedure.query(({ ctx }) => listMasterResumes(ctx.user.id)),
    saveVersion: protectedProcedure.input(z.object({ masterResumeId: z.number().int().positive(), label: z.string().trim().min(2).max(160), targetRole: z.string().trim().min(2).max(160), targetCompany: z.string().max(160).optional(), jobDescription: z.string().min(80).max(120_000), settings: z.unknown(), analysis: z.unknown(), qualityGate: z.unknown(), resumeText: z.string().min(40).max(120_000), applicationStatus: applicationStatusSchema.optional(), applicationPlatform: z.string().trim().max(80).optional(), applicationUrl: z.string().url().max(1024).optional(), appliedAt: z.number().int().optional(), applicationNotes: z.string().trim().max(2_000).optional() })).mutation(async ({ ctx, input }) => ({ id: await createTailoredVersion({ ...input, appliedAt: input.appliedAt ? new Date(input.appliedAt) : undefined, userId: ctx.user.id }) })),
    listVersions: protectedProcedure.query(({ ctx }) => listTailoredVersions(ctx.user.id)),
    updateApplication: protectedProcedure.input(z.object({ id: z.number().int().positive(), applicationStatus: applicationStatusSchema, applicationPlatform: z.string().trim().max(80).nullable().optional(), applicationUrl: z.string().url().max(1024).nullable().optional(), appliedAt: z.number().int().nullable().optional(), applicationNotes: z.string().trim().max(2_000).nullable().optional() })).mutation(({ ctx, input }) => updateTailoredVersionApplication({ userId: ctx.user.id, versionId: input.id, applicationStatus: input.applicationStatus, applicationPlatform: input.applicationPlatform, applicationUrl: input.applicationUrl, appliedAt: input.appliedAt ? new Date(input.appliedAt) : null, applicationNotes: input.applicationNotes })),
  }),
});

export type AppRouter = typeof appRouter;
