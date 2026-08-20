import { invokeLLM, listLLMModels } from "./_core/llm";
import { analyzeGeneratedResumeForAts, calculateAtsScore, createRequirementMatches, defaultSettings, formatTailoredResume, parseJobDescriptionDeterministically, parseResumeDeterministically, runQualityGate, type Claim, type GeneratedResumeAtsReview, type OptimizationSettings, type ParsedJobDescription, type ParsedResume, type ResumeExperience } from "./resumeEngine";

type AiParsedDocument = {
  resume: {
    candidate: { name: string; email: string; phone: string; location: string };
    summary: string;
    experience: Array<{ title: string; company: string; dates: string; bullets: string[] }>;
    skills: string[];
    education: string[];
  };
  job: {
    title: string;
    company: string;
    seniority: string;
    requiredSkills: string[];
    preferredSkills: string[];
    responsibilities: string[];
    qualifications: string[];
    keywords: string[];
  };
};

type AiDraft = {
  summary: { text: string; evidenceIds: string[] };
  bullets: Array<{ experienceId: string; text: string; evidenceIds: string[] }>;
};

type AiAtsNarrative = { summary: string; recommendations: string[]; caution: string };

const documentSchema = {
  type: "object",
  properties: {
    resume: {
      type: "object",
      properties: {
        candidate: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, location: { type: "string" } }, required: ["name", "email", "phone", "location"], additionalProperties: false },
        summary: { type: "string" },
        experience: { type: "array", items: { type: "object", properties: { title: { type: "string" }, company: { type: "string" }, dates: { type: "string" }, bullets: { type: "array", items: { type: "string" } } }, required: ["title", "company", "dates", "bullets"], additionalProperties: false } },
        skills: { type: "array", items: { type: "string" } },
        education: { type: "array", items: { type: "string" } },
      },
      required: ["candidate", "summary", "experience", "skills", "education"],
      additionalProperties: false,
    },
    job: {
      type: "object",
      properties: {
        title: { type: "string" }, company: { type: "string" }, seniority: { type: "string" }, requiredSkills: { type: "array", items: { type: "string" } }, preferredSkills: { type: "array", items: { type: "string" } }, responsibilities: { type: "array", items: { type: "string" } }, qualifications: { type: "array", items: { type: "string" } }, keywords: { type: "array", items: { type: "string" } },
      },
      required: ["title", "company", "seniority", "requiredSkills", "preferredSkills", "responsibilities", "qualifications", "keywords"],
      additionalProperties: false,
    },
  },
  required: ["resume", "job"],
  additionalProperties: false,
} as const;

const draftSchema = {
  type: "object",
  properties: {
    summary: { type: "object", properties: { text: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["text", "evidenceIds"], additionalProperties: false },
    bullets: { type: "array", items: { type: "object", properties: { experienceId: { type: "string" }, text: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["experienceId", "text", "evidenceIds"], additionalProperties: false } },
  },
  required: ["summary", "bullets"],
  additionalProperties: false,
} as const;

const atsNarrativeSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    recommendations: { type: "array", items: { type: "string" } },
    caution: { type: "string" },
  },
  required: ["summary", "recommendations", "caution"],
  additionalProperties: false,
} as const;

async function pickModel() {
  const { data } = await listLLMModels();
  return data.find(model => model.id === "gpt-5-mini")?.id ?? data.find(model => model.id.startsWith("gpt-5"))?.id ?? data[0]?.id;
}

function asString(value: unknown) { return typeof value === "string" ? value : ""; }
function asStringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

function mergeAiDocument(fallbackResume: ParsedResume, fallbackJob: ParsedJobDescription, result: AiParsedDocument | null): { resume: ParsedResume; job: ParsedJobDescription } {
  if (!result) return { resume: fallbackResume, job: fallbackJob };
  const experience: ResumeExperience[] = result.resume.experience.map((entry, index) => ({ id: `exp-${index + 1}`, title: asString(entry.title) || "Professional Experience", company: asString(entry.company), dates: asString(entry.dates), bullets: asStringList(entry.bullets) })).filter(entry => entry.bullets.length);
  const resume: ParsedResume = {
    candidate: { name: asString(result.resume.candidate.name) || fallbackResume.candidate.name, email: asString(result.resume.candidate.email) || fallbackResume.candidate.email, phone: asString(result.resume.candidate.phone) || fallbackResume.candidate.phone, location: asString(result.resume.candidate.location) || fallbackResume.candidate.location },
    summary: asString(result.resume.summary) || fallbackResume.summary,
    experience: experience.length ? experience : fallbackResume.experience,
    skills: asStringList(result.resume.skills).length ? asStringList(result.resume.skills) : fallbackResume.skills,
    education: asStringList(result.resume.education).length ? asStringList(result.resume.education) : fallbackResume.education,
    sourceText: fallbackResume.sourceText,
  };
  const job = parseJobDescriptionDeterministically(fallbackJob.sourceText, asString(result.job.title) || fallbackJob.title, asString(result.job.company) || fallbackJob.company);
  job.seniority = asString(result.job.seniority) || fallbackJob.seniority;
  job.requiredSkills = asStringList(result.job.requiredSkills).length ? asStringList(result.job.requiredSkills) : fallbackJob.requiredSkills;
  job.preferredSkills = asStringList(result.job.preferredSkills).length ? asStringList(result.job.preferredSkills) : fallbackJob.preferredSkills;
  job.responsibilities = asStringList(result.job.responsibilities).length ? asStringList(result.job.responsibilities) : fallbackJob.responsibilities;
  job.qualifications = asStringList(result.job.qualifications).length ? asStringList(result.job.qualifications) : fallbackJob.qualifications;
  job.keywords = asStringList(result.job.keywords).length ? asStringList(result.job.keywords) : fallbackJob.keywords;
  return { resume, job };
}

async function extractStructuredDocuments(resumeText: string, jobDescription: string, settings: OptimizationSettings) {
  const fallback = { resume: parseResumeDeterministically(resumeText), job: parseJobDescriptionDeterministically(jobDescription, settings.targetRole, settings.targetCompany) };
  try {
    const model = await pickModel();
    if (!model) return fallback;
    const response = await invokeLLM({
      model,
      maxTokens: 7000,
      messages: [
        { role: "system", content: "You extract structured resume and job-description data. Use only text explicitly present in the supplied documents. Leave any unsupported field empty. Do not infer skills, metrics, dates, employers, qualifications, or job requirements." },
        { role: "user", content: `SOURCE RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nUSER CONTEXT (only use to label the target, not to invent facts):\n${JSON.stringify({ targetRole: settings.targetRole, targetCompany: settings.targetCompany })}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "structured_resume_and_job", strict: true, schema: documentSchema } },
    });
    const content = response.choices[0]?.message.content;
    return mergeAiDocument(fallback.resume, fallback.job, typeof content === "string" ? JSON.parse(content) as AiParsedDocument : null);
  } catch (error) {
    console.warn("[Resume AI] Structured extraction fell back to deterministic parsing", error);
    return fallback;
  }
}

async function createGroundedDraft(resume: ParsedResume, job: ParsedJobDescription, settings: OptimizationSettings): Promise<AiDraft> {
  const fallback: AiDraft = {
    summary: { text: resume.summary || `Professional with experience relevant to ${settings.targetRole || job.title}.`, evidenceIds: resume.summary ? ["summary"] : [] },
    bullets: resume.experience.flatMap(experience => experience.bullets.map((text, index) => ({ experienceId: experience.id, text, evidenceIds: [`${experience.id}-bullet-${index + 1}`] }))),
  };
  try {
    const model = await pickModel();
    if (!model) return fallback;
    const sourceEvidence = resume.experience.flatMap(experience => experience.bullets.map((text, index) => ({ id: `${experience.id}-bullet-${index + 1}`, experienceId: experience.id, text }))).concat(resume.summary ? [{ id: "summary", experienceId: "", text: resume.summary }] : []);
    const response = await invokeLLM({
      model,
      maxTokens: 5000,
      messages: [
        { role: "system", content: "You are a resume editor operating in Strict Truth Mode. Rewrite only by clarifying, prioritizing, and improving wording grounded in the supplied source evidence. Every output sentence requires one or more evidenceIds. Never add a skill, number, metric, employer, title, certification, or responsibility that is not explicitly supported. Do not use a requirement from the job description as evidence. If evidence is not sufficient, preserve the original wording instead of embellishing." },
        { role: "user", content: JSON.stringify({ target: { role: settings.targetRole || job.title, company: settings.targetCompany || job.company, tone: settings.tone }, jobKeywords: job.keywords, sourceEvidence }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "grounded_resume_draft", strict: true, schema: draftSchema } },
    });
    const content = response.choices[0]?.message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) as AiDraft : null;
    return parsed?.bullets?.length ? parsed : fallback;
  } catch (error) {
    console.warn("[Resume AI] Grounded rewriting fell back to original resume wording", error);
    return fallback;
  }
}

async function createGeneratedAtsNarrative(review: GeneratedResumeAtsReview, job: ParsedJobDescription): Promise<GeneratedResumeAtsReview> {
  try {
    const model = await pickModel();
    if (!model) return review;
    const response = await invokeLLM({
      model,
      maxTokens: 1600,
      messages: [
        { role: "system", content: "You are an evidence-first ATS optimization reviewer. Explain only the supplied generated-resume versus job-description review. Never invent missing experience, skills, metrics, or qualifications. Do not claim that an employer ATS will accept or reject the candidate. Keep all recommendations short and frame gaps as evidence the candidate may add only if genuine." },
        { role: "user", content: JSON.stringify({ jobTitle: job.title, requirements: job.requirements.map(item => item.name), deterministicReview: review }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "generated_resume_ats_narrative", strict: true, schema: atsNarrativeSchema } },
    });
    const content = response.choices[0]?.message.content;
    const narrative = typeof content === "string" ? JSON.parse(content) as AiAtsNarrative : null;
    return narrative ? { ...review, summary: asString(narrative.summary) || review.summary, recommendations: asStringList(narrative.recommendations).slice(0, 5).length ? asStringList(narrative.recommendations).slice(0, 5) : review.recommendations, caution: asString(narrative.caution) || review.caution } : review;
  } catch (error) {
    console.warn("[Resume AI] Generated ATS narrative fell back to deterministic review", error);
    return review;
  }
}

export async function analyzeResumeForJob(input: { resumeText: string; jobDescription: string; settings?: Partial<OptimizationSettings> }) {
  const settings = { ...defaultSettings(), ...input.settings, strictTruthMode: true };
  const documents = await extractStructuredDocuments(input.resumeText, input.jobDescription, settings);
  const matches = createRequirementMatches(documents.resume, documents.job);
  const score = calculateAtsScore(documents.resume, documents.job, matches);
  const draft = await createGroundedDraft(documents.resume, documents.job, settings);
  const claims: Claim[] = [
    ...(draft.summary.text ? [{ section: "Professional summary", text: draft.summary.text, evidenceIds: draft.summary.evidenceIds }] : []),
    ...draft.bullets.map(bullet => ({ section: "Experience", text: bullet.text, evidenceIds: bullet.evidenceIds })),
  ];
  const optimizedText = formatTailoredResume(documents.resume, draft.summary.text, draft.bullets, settings);
  const qualityGate = runQualityGate(documents.resume, optimizedText, claims);
  const atsReview = await createGeneratedAtsNarrative(analyzeGeneratedResumeForAts(optimizedText, documents.job), documents.job);
  return { settings, resume: documents.resume, job: documents.job, matches, score, draft, claims, optimizedText, qualityGate, atsReview };
}
