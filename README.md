# Verity — Evidence-First ATS Resume Builder

> **AI-powered job-tailored resume optimization designed for truthful ATS-friendly parsing and stronger job-description alignment.**

Verity is a full-stack resume optimization workspace for candidates who want to tailor a resume to a specific job description **without inventing experience**. It turns a source resume and target role into an evidence-mapped, professionally rewritten resume, while clearly distinguishing exact support, semantic relationships, related experience, and unsupported gaps.

The product deliberately treats an ATS score as an **internal optimization estimate**, not as a promise that any employer’s system will accept a resume.

## Live demo

**[Open the live Verity app](https://ats-resume-xs7wcjtr.manus.space)**

The demonstration environment includes the complete full-stack workflow: document intake, evidence-mapped analysis, grounded tailoring, quality-gated export preparation, and tailored-version persistence.

## 72-second product walkthrough

[![Watch the 72-second Verity walkthrough](https://ats-resume-xs7wcjtr.manus.space/manus-storage/verity-walkthrough-poster_c7ea93b2.webp)](https://ats-resume-xs7wcjtr.manus.space/manus-storage/verity-walkthrough_28ac3ffe.mp4)

**[Watch the sanitized 72-second walkthrough](https://ats-resume-xs7wcjtr.manus.space/manus-storage/verity-walkthrough_28ac3ffe.mp4)**. It uses only Verity’s synthetic guided example and demonstrates source intake, evidence-aware ATS review, tailored-version tracking, and quality-gated PDF/DOCX exports.

## Product walkthrough

The following screenshots use Verity’s built-in synthetic guided example. They do not contain a user-provided resume or real candidate information.

### Evidence-first intake and tailoring controls

![Verity guided intake and tailoring controls](https://ats-resume-xs7wcjtr.manus.space/manus-storage/verity-guided-intake_d1c1a7b9.webp)

### Truth-aware quality gate and exports

![Verity final quality gate with text, PDF, and DOCX preparation](https://ats-resume-xs7wcjtr.manus.space/manus-storage/verity-quality-gate_598b8d80.webp)

## Product principles

| Principle | How it is implemented |
| --- | --- |
| **Strict Truth Mode** | Enabled by default and enforced during rewriting. Proposed claims must cite source-resume evidence. |
| **Evidence before equivalence** | Requirements are categorized as exact, curated semantic, related, or insufficient evidence. Related skills never become substitute claims. |
| **Actionable transparency** | The score explains what is supported, what is missing, and what a candidate may clarify only if it is true. |
| **Master-resume preservation** | Tailored variants are saved separately from the original source resume. |
| **Quality before export** | A truth-aware quality gate is run before each text, PDF, or DOCX export is prepared. |

## Experience

The core flow is intentionally focused:

```text
Resume intake → Job description → Evidence map → Grounded tailoring → Claim review → Quality gate → Export
```

Candidates can paste resume text or extract text from PDF, DOCX, or TXT files. The workspace then analyzes the job description, calculates an explainable compatibility estimate, and produces a source-traceable tailored resume.

## Key capabilities

| Area | Included capabilities |
| --- | --- |
| **Document intake** | Resume and job-description paste inputs, plus browser-side PDF, DOCX, and TXT extraction. |
| **Structured analysis** | Candidate details, summary, experience, skills, education, job requirements, priorities, and keywords. |
| **Matching engine** | Exact Match, Curated Semantic Match, Related Skill, and Insufficient Evidence tiers. |
| **Grounded rewriting** | LLM-assisted summary and bullet rewriting that requires evidence IDs for every claim. |
| **Truth Guard** | Detects missing citations, untraceable metrics, and claims with weak textual overlap with their cited evidence. |
| **ATS review** | Weighted source-resume estimate plus an AI-assisted generated-resume-versus-job review with direct matches, related evidence, gaps, and evidence-based next checks. |
| **Candidate controls** | Target title/company, tone, seniority, template, page length, keyword emphasis, and section preferences. |
| **Quality gate** | Contact details, conventional sections, dates, standard headings, keyword density, professional tone, evidence status, and ATS-safe formatting. |
| **Export** | Text, PDF, and DOCX artifact preparation after a fresh quality-gate recheck. |
| **Persistence and tracking** | Authenticated storage for master resumes and independently saved tailored versions, with application platform, submission date, notes, and stage tracking. |

## Architecture

```text
React + TypeScript client
      │
      ├─ PDF/DOCX/TXT extraction (browser)
      ├─ Tailoring controls and claim review
      └─ Text/PDF/DOCX artifact preparation
      │
tRPC API (Express)
      │
      ├─ Resume parser + JD analyzer
      ├─ Evidence-tier matching engine
      ├─ Weighted ATS estimation
      ├─ Strict Truth Guard + quality gate
      └─ Structured server-side LLM calls
      │
MySQL / Drizzle
      ├─ Master resumes
      └─ Tailored resume versions
```

The application uses a deterministic analysis layer for safe baseline behavior and structured server-side AI calls for richer parsing and rewriting. If an AI call is unavailable, it falls back to deterministic parsing and preserves original wording rather than fabricating content.

## Local development

### Prerequisites

You need Node.js 22+ and pnpm. The managed project environment supplies database, authentication, and server-side AI credentials.

### Run the app

```bash
pnpm install
pnpm dev
```

### Validate changes

```bash
pnpm test
pnpm check
```

### Database migrations

The project uses Drizzle. Generate a migration after schema updates, review the SQL, then apply it through the project’s database workflow.

```bash
pnpm drizzle-kit generate
```

## Data model

| Model | Purpose |
| --- | --- |
| `users` | Authenticated user records. |
| `masterResumes` | Original source resumes, retained separately from tailored outputs. |
| `tailoredResumeVersions` | Job-specific tailored resume text, settings, analysis result, quality-gate state, target-job context, and application-tracking metadata. |

## Responsible AI guardrails

Verity does **not** infer an unprovided certification, technology, employer, title, metric, or responsibility. It can improve language, reorder relevant evidence, and surface supported experience. It can also invite the candidate to add evidence that is genuinely true, but it will not write the claim until it is supported.

The curated semantic dictionary is intentionally narrow. A related skill receives limited analytical credit and is visibly labelled as related rather than being presented as an equivalent qualification.

## Current implementation boundaries

This project is a working SaaS prototype. Resume document text is extracted in the browser, then source text is analyzed on the server to produce the review. Production hardening should add file-size limits, malware scanning, a document-retention policy, explicit deletion controls, richer date normalization, and dedicated export rendering templates.

## License

MIT
