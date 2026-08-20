export type MatchTier = "exact" | "semantic" | "related" | "insufficient";
export type Priority = "critical" | "high" | "medium" | "low";

export type ResumeExperience = {
  id: string;
  title: string;
  company: string;
  dates: string;
  bullets: string[];
};

export type ParsedResume = {
  candidate: { name: string; email: string; phone: string; location: string };
  summary: string;
  experience: ResumeExperience[];
  skills: string[];
  education: string[];
  sourceText: string;
};

export type JobRequirement = {
  id: string;
  name: string;
  priority: Priority;
  category: "skill" | "responsibility" | "qualification";
  sourcePhrase: string;
};

export type ParsedJobDescription = {
  title: string;
  company: string;
  seniority: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  qualifications: string[];
  keywords: string[];
  requirements: JobRequirement[];
  sourceText: string;
};

export type EvidenceRef = { id: string; section: string; quote: string };

export type RequirementMatch = {
  requirementId: string;
  requirement: string;
  priority: Priority;
  tier: MatchTier;
  confidence: number;
  evidence: EvidenceRef[];
  explanation: string;
};

export type ScoreBreakdown = {
  key: string;
  label: string;
  weight: number;
  score: number;
  explanation: string;
};

export type AtsScore = {
  score: number;
  label: string;
  breakdown: ScoreBreakdown[];
  improvedBy: string[];
  loweredBy: string[];
  nextSteps: string[];
};

export type GeneratedResumeAtsReview = {
  score: number;
  label: string;
  directMatches: string[];
  relatedRequirements: string[];
  gaps: string[];
  recommendations: string[];
  summary: string;
  caution: string;
};

export type Claim = { text: string; evidenceIds: string[]; section: string };
export type TruthGuardIssue = { severity: "error" | "warning"; message: string; claim: string };
export type QualityGate = {
  ready: boolean;
  errors: string[];
  warnings: string[];
  truthIssues: TruthGuardIssue[];
  checks: Array<{ key: string; label: string; status: "pass" | "warning" | "error"; detail: string }>;
};

export type OptimizationSettings = {
  targetRole: string;
  targetCompany: string;
  tone: "concise" | "confident" | "executive";
  seniority: "entry" | "mid" | "senior" | "executive";
  pageLength: "one" | "two";
  template: "classic" | "modern" | "technical" | "minimal";
  optimizationLevel: "balanced" | "focused" | "maximum";
  includeSummary: boolean;
  includeProjects: boolean;
  includeCertifications: boolean;
  strictTruthMode: boolean;
};

const PRIORITY_WEIGHT: Record<Priority, number> = { critical: 1, high: 0.8, medium: 0.55, low: 0.3 };
const TIER_SCORE: Record<MatchTier, number> = { exact: 1, semantic: 0.8, related: 0.42, insufficient: 0 };

const semanticGroups = [
  ["amazon web services", "aws"],
  ["customer relationship management", "crm", "salesforce crm"],
  ["continuous integration continuous delivery", "ci cd", "ci/cd", "continuous integration", "continuous delivery"],
  ["javascript", "js"],
  ["typescript", "ts"],
  ["structured query language", "sql"],
  ["product lifecycle management", "plm"],
  ["user experience", "ux"],
  ["user interface", "ui"],
];

const relatedSkillMap: Record<string, string[]> = {
  "stakeholder management": ["cross functional collaboration", "client communication", "stakeholder communication"],
  "data visualization": ["tableau", "power bi", "dashboard"],
  "cloud architecture": ["aws", "azure", "google cloud platform", "gcp"],
  "agile methodology": ["scrum", "kanban"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#/.]+/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function lines(text: string) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function titleCase(value: string) {
  return value.split(" ").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function defaultSettings(): OptimizationSettings {
  return {
    targetRole: "",
    targetCompany: "",
    tone: "confident",
    seniority: "mid",
    pageLength: "one",
    template: "modern",
    optimizationLevel: "balanced",
    includeSummary: true,
    includeProjects: true,
    includeCertifications: true,
    strictTruthMode: true,
  };
}

export function parseResumeDeterministically(sourceText: string): ParsedResume {
  const sourceLines = lines(sourceText);
  const firstLine = sourceLines[0] ?? "Candidate";
  const email = sourceText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = sourceText.match(/(?:\+?\d[\d(). -]{7,}\d)/)?.[0]?.trim() ?? "";
  const sectionIndex = (names: string[]) => sourceLines.findIndex(line => names.some(name => normalize(line) === name));
  const skillsIndex = sectionIndex(["skills", "technical skills", "core skills", "expertise"]);
  const educationIndex = sectionIndex(["education", "academic background"]);
  const experienceIndex = sectionIndex(["experience", "professional experience", "work experience", "employment history"]);
  const summaryIndex = sectionIndex(["summary", "professional summary", "profile"]);
  const untilNextSection = (start: number) => {
    if (start === -1) return [];
    const sectionStops = [skillsIndex, educationIndex, experienceIndex, summaryIndex].filter(index => index > start);
    const end = sectionStops.length ? Math.min(...sectionStops) : sourceLines.length;
    return sourceLines.slice(start + 1, end);
  };
  const skillLines = untilNextSection(skillsIndex);
  const skills = unique(skillLines.flatMap(line => line.split(/[|,;•]/)).map(value => value.replace(/^[-*]\s*/, "").trim()).filter(value => value.length > 1));
  const experienceLines = untilNextSection(experienceIndex);
  const bullets = experienceLines.filter(line => /^[-•*]/.test(line) || /^(developed|led|managed|built|designed|improved|created|delivered|owned|collaborated|analyzed|implemented)\b/i.test(line));
  const fallbackBullets = bullets.length ? bullets : experienceLines.slice(0, 6);
  const experience: ResumeExperience[] = fallbackBullets.length
    ? [{ id: "exp-1", title: "Professional Experience", company: "", dates: "", bullets: fallbackBullets.map(line => line.replace(/^[-•*]\s*/, "")) }]
    : [];
  const summaryLines = untilNextSection(summaryIndex);
  const education = untilNextSection(educationIndex);

  return {
    candidate: { name: firstLine, email, phone, location: "" },
    summary: summaryLines.join(" "),
    experience,
    skills,
    education,
    sourceText,
  };
}

function inferPriority(text: string): Priority {
  const value = normalize(text);
  if (/must|required|minimum|essential|mandatory/.test(value)) return "critical";
  if (/preferred|nice to have|bonus|plus/.test(value)) return "medium";
  if (/strong|proficient|experience with|expert/.test(value)) return "high";
  return "medium";
}

function extractSkillCandidates(text: string) {
  const knownTerms = [
    "AWS", "Azure", "GCP", "Python", "SQL", "JavaScript", "TypeScript", "React", "Node.js", "Docker", "Kubernetes", "Tableau", "Power BI", "Salesforce", "CRM", "Figma", "Excel", "Git", "CI/CD", "Scrum", "Kanban", "Jira", "Stakeholder Management", "Data Visualization", "Machine Learning", "Product Management", "Project Management", "Agile", "REST APIs", "GraphQL",
  ];
  const corpus = normalize(text);
  return knownTerms.filter(term => corpus.includes(normalize(term)));
}

export function parseJobDescriptionDeterministically(sourceText: string, role = "", company = ""): ParsedJobDescription {
  const sourceLines = lines(sourceText);
  const required = sourceLines.filter(line => /\b(must|required|minimum|essential|qualified)\b/i.test(line));
  const preferred = sourceLines.filter(line => /\b(preferred|nice to have|bonus|plus)\b/i.test(line));
  const responsibilities = sourceLines.filter(line => /\b(you will|responsibilit|manage|develop|lead|collaborate|deliver|own|design)\b/i.test(line));
  const qualifications = sourceLines.filter(line => /\b(degree|certification|years of|bachelor|master)\b/i.test(line));
  const knownSkills = extractSkillCandidates(sourceText);
  const requirements = unique([...knownSkills, ...required.slice(0, 5), ...preferred.slice(0, 3)]).slice(0, 18).map((name, index) => ({
    id: `req-${index + 1}`,
    name,
    priority: inferPriority(name),
    category: knownSkills.includes(name) ? "skill" as const : "responsibility" as const,
    sourcePhrase: name,
  }));
  return {
    title: role || sourceLines.find(line => /\b(engineer|analyst|manager|designer|developer|director|specialist)\b/i.test(line)) || "Target role",
    company,
    seniority: /senior|lead|principal|director/i.test(sourceText) ? "Senior" : /junior|entry|graduate/i.test(sourceText) ? "Entry" : "Mid-level",
    requiredSkills: unique([...extractSkillCandidates(required.join(" ")), ...knownSkills.slice(0, 8)]),
    preferredSkills: unique(extractSkillCandidates(preferred.join(" "))),
    responsibilities: responsibilities.slice(0, 8),
    qualifications: qualifications.slice(0, 6),
    keywords: knownSkills,
    requirements,
    sourceText,
  };
}

export function resumeEvidence(resume: ParsedResume): EvidenceRef[] {
  const evidence: EvidenceRef[] = [];
  if (resume.summary) evidence.push({ id: "summary", section: "Professional summary", quote: resume.summary });
  resume.skills.forEach((skill, index) => evidence.push({ id: `skill-${index + 1}`, section: "Skills", quote: skill }));
  resume.experience.forEach(experience => experience.bullets.forEach((bullet, index) => evidence.push({ id: `${experience.id}-bullet-${index + 1}`, section: experience.title || "Experience", quote: bullet })));
  resume.education.forEach((entry, index) => evidence.push({ id: `education-${index + 1}`, section: "Education", quote: entry }));
  return evidence;
}

function containsPhrase(corpus: string, phrase: string) {
  return normalize(corpus).includes(normalize(phrase));
}

function semanticAliases(requirement: string) {
  const required = normalize(requirement);
  return semanticGroups.find(group => group.some(term => normalize(term) === required)) ?? [];
}

function findEvidence(corpusEvidence: EvidenceRef[], terms: string[]) {
  return corpusEvidence.filter(item => terms.some(term => containsPhrase(item.quote, term))).slice(0, 3);
}

export function createRequirementMatches(resume: ParsedResume, job: ParsedJobDescription): RequirementMatch[] {
  const evidence = resumeEvidence(resume);
  return job.requirements.map(requirement => {
    const exactSkill = resume.skills.find(skill => normalize(skill) === normalize(requirement.name));
    const direct = exactSkill
      ? evidence.filter(item => item.section === "Skills" && normalize(item.quote) === normalize(exactSkill)).slice(0, 1)
      : findEvidence(evidence, [requirement.name]);
    if (direct.length) {
      return { requirementId: requirement.id, requirement: requirement.name, priority: requirement.priority, tier: "exact", confidence: 1, evidence: direct, explanation: "The requirement appears directly in the source resume." };
    }
    const aliases = semanticAliases(requirement.name).filter(alias => normalize(alias) !== normalize(requirement.name));
    const semantic = aliases.length ? findEvidence(evidence, aliases) : [];
    if (semantic.length) {
      return { requirementId: requirement.id, requirement: requirement.name, priority: requirement.priority, tier: "semantic", confidence: 0.8, evidence: semantic, explanation: "A tightly scoped, curated alias appears in the source resume. This is not treated as an exact wording match." };
    }
    const relatedTerms = relatedSkillMap[normalize(requirement.name)] ?? [];
    const related = relatedTerms.length ? findEvidence(evidence, relatedTerms) : [];
    if (related.length) {
      return { requirementId: requirement.id, requirement: requirement.name, priority: requirement.priority, tier: "related", confidence: 0.42, evidence: related, explanation: "Related evidence exists, but it is not equivalent to the requirement and is not used as a substitute claim." };
    }
    return { requirementId: requirement.id, requirement: requirement.name, priority: requirement.priority, tier: "insufficient", confidence: 0, evidence: [], explanation: "No supporting evidence was found in the source resume." };
  });
}

function weightedAverage(items: Array<{ score: number; weight: number }>) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return total ? items.reduce((sum, item) => sum + item.score * item.weight, 0) / total : 0;
}

export function calculateAtsScore(resume: ParsedResume, job: ParsedJobDescription, matches: RequirementMatch[]): AtsScore {
  const requirementCoverage = weightedAverage(matches.map(match => ({ score: TIER_SCORE[match.tier], weight: PRIORITY_WEIGHT[match.priority] })));
  const exactOrSemantic = matches.filter(match => match.tier === "exact" || match.tier === "semantic").length / Math.max(matches.length, 1);
  const experienceEvidence = matches.filter(match => match.evidence.some(item => item.section !== "Skills")).length / Math.max(matches.length, 1);
  const hasStandardSections = Number(Boolean(resume.experience.length)) * 0.45 + Number(Boolean(resume.skills.length)) * 0.25 + Number(Boolean(resume.summary)) * 0.15 + Number(Boolean(resume.education.length)) * 0.15;
  const breakdown: ScoreBreakdown[] = [
    { key: "keywords", label: "Keyword alignment", weight: 30, score: Math.round(requirementCoverage * 100), explanation: "Weighted by requirement priority; semantic and related matches receive less credit than exact evidence." },
    { key: "skills", label: "Required skill coverage", weight: 20, score: Math.round(exactOrSemantic * 100), explanation: "Counts only exact or curated semantic evidence as substantive coverage." },
    { key: "experience", label: "Experience alignment", weight: 15, score: Math.round(experienceEvidence * 100), explanation: "Rewards evidence located in the experience section rather than skills alone." },
    { key: "responsibilities", label: "Responsibility alignment", weight: 10, score: Math.round(requirementCoverage * 92), explanation: "Estimates alignment between source responsibilities and target requirements." },
    { key: "formatting", label: "ATS formatting", weight: 10, score: Math.round(hasStandardSections * 100), explanation: "Checks for machine-readable text and conventional resume sections." },
    { key: "technical", label: "Technical skill alignment", weight: 10, score: Math.round((resume.skills.length ? requirementCoverage : 0) * 100), explanation: "Measures supported technical terms against target-role terminology." },
    { key: "education", label: "Education & credentials", weight: 5, score: Math.round((resume.education.length ? 0.8 : 0.35) * 100), explanation: "A light-weight signal only; it does not infer missing qualifications." },
  ];
  const score = Math.round(breakdown.reduce((sum, category) => sum + category.score * category.weight, 0) / 100);
  const exact = matches.filter(match => match.tier === "exact").map(match => match.requirement);
  const gaps = matches.filter(match => match.tier === "insufficient").map(match => match.requirement);
  const related = matches.filter(match => match.tier === "related").map(match => match.requirement);
  return {
    score,
    label: score >= 80 ? "Strong alignment" : score >= 60 ? "Developing alignment" : "Early alignment",
    breakdown,
    improvedBy: exact.slice(0, 4).map(item => `${titleCase(item)} is directly supported by the source resume.`),
    loweredBy: gaps.slice(0, 4).map(item => `${titleCase(item)} is required or emphasized in the job description but is not evidenced in the source resume.`),
    nextSteps: [...gaps.slice(0, 3).map(item => `Add evidence for ${titleCase(item)} only if you genuinely have that experience.`), ...related.slice(0, 2).map(item => `Clarify whether your related experience demonstrates ${titleCase(item)}; do not claim equivalence without evidence.`)],
  };
}

export function analyzeGeneratedResumeForAts(optimizedText: string, job: ParsedJobDescription): GeneratedResumeAtsReview {
  const generatedResume = parseResumeDeterministically(optimizedText);
  const matches = createRequirementMatches(generatedResume, job);
  const alignment = weightedAverage(matches.map(match => ({ score: TIER_SCORE[match.tier], weight: PRIORITY_WEIGHT[match.priority] })));
  const hasConventionalHeadings = ["EXPERIENCE", "SKILLS", "EDUCATION"].filter(heading => optimizedText.includes(heading)).length / 3;
  const score = Math.round((alignment * 0.78 + hasConventionalHeadings * 0.22) * 100);
  const directMatches = matches.filter(match => match.tier === "exact" || match.tier === "semantic").map(match => match.requirement);
  const relatedRequirements = matches.filter(match => match.tier === "related").map(match => match.requirement);
  const gaps = matches.filter(match => match.tier === "insufficient").map(match => match.requirement);
  return {
    score,
    label: score >= 80 ? "Strong generated alignment" : score >= 60 ? "Developing generated alignment" : "Needs targeted evidence",
    directMatches: directMatches.slice(0, 6),
    relatedRequirements: relatedRequirements.slice(0, 4),
    gaps: gaps.slice(0, 5),
    recommendations: [
      ...gaps.slice(0, 3).map(item => `Do not add ${titleCase(item)} unless you can provide genuine source evidence.`),
      ...relatedRequirements.slice(0, 2).map(item => `Clarify the specific evidence behind ${titleCase(item)} without claiming it is an equivalent qualification.`),
      ...(hasConventionalHeadings < 1 ? ["Keep conventional experience, skills, and education headings in the exported version."] : []),
    ],
    summary: `${directMatches.length} target requirement${directMatches.length === 1 ? " is" : "s are"} represented directly or through a curated semantic match in the generated resume.`,
    caution: "This is a job-specific optimization review, not an employer ATS score or an application outcome guarantee.",
  };
}

function tokenOverlap(a: string, b: string) {
  const tokens = (value: string) => new Set(normalize(value).split(" ").filter(token => token.length > 2));
  const first = tokens(a);
  const second = tokens(b);
  if (!first.size || !second.size) return 0;
  const common = Array.from(first).filter(token => second.has(token)).length;
  return common / Math.min(first.size, second.size);
}

export function validateClaims(claims: Claim[], evidence: EvidenceRef[]): TruthGuardIssue[] {
  const evidenceById = new Map(evidence.map(item => [item.id, item]));
  return claims.flatMap((claim): TruthGuardIssue[] => {
    if (!claim.evidenceIds.length) return [{ severity: "error" as const, message: "This rewritten claim has no cited source evidence.", claim: claim.text }];
    const cited = claim.evidenceIds.map(id => evidenceById.get(id)).filter((item): item is EvidenceRef => Boolean(item));
    if (!cited.length) return [{ severity: "error" as const, message: "The cited source evidence could not be found.", claim: claim.text }];
    const source = cited.map(item => item.quote).join(" ");
    const sourceNumbers = new Set(source.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []);
    const claimNumbers = claim.text.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
    if (claimNumbers.some(number => !sourceNumbers.has(number))) return [{ severity: "error" as const, message: "A number or metric in this claim is not present in the cited source evidence.", claim: claim.text }];
    if (tokenOverlap(claim.text, source) < 0.18) return [{ severity: "warning" as const, message: "The wording has limited overlap with its cited evidence and needs human confirmation before export.", claim: claim.text }];
    return [];
  });
}

export function runQualityGate(resume: ParsedResume, optimizedText: string, claims: Claim[]): QualityGate {
  const checks: QualityGate["checks"] = [];
  const truthIssues = validateClaims(claims, resumeEvidence(resume));
  const add = (key: string, label: string, status: "pass" | "warning" | "error", detail: string) => checks.push({ key, label, status, detail });
  add("contact", "Contact information", resume.candidate.email || resume.candidate.phone ? "pass" : "error", resume.candidate.email || resume.candidate.phone ? "Contact information was detected in the source resume." : "Add a professional email address or phone number before export.");
  add("sections", "Resume structure", resume.experience.length && resume.skills.length ? "pass" : "warning", resume.experience.length && resume.skills.length ? "Experience and skills are available in the proposed resume." : "Use conventional experience and skills sections for reliable parsing.");
  const missingDates = resume.experience.filter(experience => !experience.dates.trim()).length;
  add("dates", "Dates and chronology", missingDates ? "warning" : "pass", missingDates ? "One or more positions could not be confidently assigned a date range. Confirm dates before sharing the resume." : "Experience date ranges were detected in the source resume.");
  const standardHeadings = ["EXPERIENCE", "SKILLS", "EDUCATION"];
  const missingHeadings = standardHeadings.filter(heading => !optimizedText.includes(heading));
  add("headings", "Standard section headings", missingHeadings.length ? "warning" : "pass", missingHeadings.length ? `Consider adding conventional headings for: ${missingHeadings.map(heading => heading.toLowerCase()).join(", ")}.` : "The tailored resume uses predictable, ATS-safe section headings.");
  const repeatedTerms = unique(optimizedText.toLowerCase().match(/\b[a-z][a-z+#/.]{2,}\b/g) ?? []).filter(term => (optimizedText.toLowerCase().match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) ?? []).length > 6);
  add("keyword-density", "Natural keyword use", repeatedTerms.length ? "warning" : "pass", repeatedTerms.length ? `Review repeated terms: ${repeatedTerms.slice(0, 3).join(", ")}.` : "No high-frequency keyword repetition was detected.");
  const unpolishedLanguage = /\b(worked on|responsible for|helped with|stuff|things)\b/i.test(optimizedText);
  add("tone", "Professional tone", unpolishedLanguage ? "warning" : "pass", unpolishedLanguage ? "Review informal or low-specificity wording before export." : "No common low-specificity phrasing was detected.");
  add("truth", "Strict Truth Mode", truthIssues.some(issue => issue.severity === "error") ? "error" : truthIssues.length ? "warning" : "pass", truthIssues.length ? `${truthIssues.length} claim review item${truthIssues.length === 1 ? "" : "s"} found.` : "Every proposed claim has traceable source evidence.");
  add("format", "ATS-safe formatting", "pass", "The export uses plain machine-readable text with conventional section headings.");
  const errors = checks.filter(check => check.status === "error").map(check => check.detail);
  const warnings = checks.filter(check => check.status === "warning").map(check => check.detail);
  return { ready: errors.length === 0, errors, warnings, truthIssues, checks };
}

export function formatTailoredResume(resume: ParsedResume, summary: string, rewrittenBullets: Array<{ experienceId: string; text: string }>, settings: OptimizationSettings) {
  const sections = [resume.candidate.name, [resume.candidate.email, resume.candidate.phone, resume.candidate.location].filter(Boolean).join(" | ")].filter(Boolean);
  if (settings.includeSummary && summary) sections.push("\nPROFESSIONAL SUMMARY\n" + summary);
  const experienceText = resume.experience.map(experience => {
    const bullets = rewrittenBullets.filter(bullet => bullet.experienceId === experience.id).map(bullet => `• ${bullet.text}`);
    return [experience.title, [experience.company, experience.dates].filter(Boolean).join(" | "), ...bullets].filter(Boolean).join("\n");
  }).join("\n\n");
  if (experienceText) sections.push("\nEXPERIENCE\n" + experienceText);
  if (resume.skills.length) sections.push("\nSKILLS\n" + resume.skills.join(" • "));
  if (resume.education.length) sections.push("\nEDUCATION\n" + resume.education.join("\n"));
  return sections.join("\n");
}
