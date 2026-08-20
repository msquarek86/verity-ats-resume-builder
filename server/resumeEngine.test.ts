import { describe, expect, it } from "vitest";
import { analyzeGeneratedResumeForAts, calculateAtsScore, createRequirementMatches, parseJobDescriptionDeterministically, parseResumeDeterministically, runQualityGate, validateClaims } from "./resumeEngine";

const resumeText = `Avery Morgan\navery@example.com | 555-0100\n\nPROFESSIONAL SUMMARY\nData analyst with experience building Tableau dashboards and SQL reporting.\n\nEXPERIENCE\nData Analyst | Northstar\n• Built recurring Tableau dashboards for revenue reporting.\n• Wrote SQL queries to analyze customer performance.\n\nSKILLS\nSQL, Tableau, Python, Stakeholder communication\n\nEDUCATION\nB.S. Information Systems`;

const jdText = `Senior Data Analyst\nRequired: SQL, data visualization, and stakeholder management.\nMust build business dashboards and communicate findings.`;

describe("evidence-first ATS engine", () => {
  it("keeps exact, related, and unsupported evidence distinct", () => {
    const resume = parseResumeDeterministically(resumeText);
    const job = parseJobDescriptionDeterministically(jdText);
    const matches = createRequirementMatches(resume, job);

    expect(matches.find(match => match.requirement.toLowerCase() === "sql")?.tier).toBe("exact");
    expect(matches.find(match => match.requirement.toLowerCase() === "data visualization")?.tier).toBe("related");
    expect(matches.find(match => match.requirement.toLowerCase() === "stakeholder management")?.tier).toBe("related");
  });

  it("never approves a metric that is absent from cited evidence", () => {
    const resume = parseResumeDeterministically(resumeText);
    const issues = validateClaims([{ section: "Experience", text: "Increased revenue by 25% through Tableau dashboards.", evidenceIds: ["exp-1-bullet-1"] }], [{ id: "exp-1-bullet-1", section: "Experience", quote: resume.experience[0]!.bullets[0]! }]);

    expect(issues.some(issue => issue.severity === "error")).toBe(true);
  });

  it("produces an explainable score and blocks quality gate only for meaningful errors", () => {
    const resume = parseResumeDeterministically(resumeText);
    const job = parseJobDescriptionDeterministically(jdText);
    const matches = createRequirementMatches(resume, job);
    const score = calculateAtsScore(resume, job, matches);
    const gate = runQualityGate(resume, resumeText, [{ section: "Experience", text: resume.experience[0]!.bullets[0]!, evidenceIds: ["exp-1-bullet-1"] }]);

    expect(score.breakdown).toHaveLength(7);
    expect(score.score).toBeGreaterThan(0);
    expect(gate.ready).toBe(true);
  });

  it("reviews the generated resume against the target job without converting gaps into qualifications", () => {
    const job = parseJobDescriptionDeterministically(jdText);
    const review = analyzeGeneratedResumeForAts(resumeText, job);

    expect(review.directMatches).toContain("SQL");
    expect(review.relatedRequirements).toContain("Data Visualization");
    expect(review.gaps).not.toContain("SQL");
    expect(review.caution).toContain("not an employer ATS score");
  });

  it("separates JD section labels from the actual required and preferred keywords", () => {
    const job = parseJobDescriptionDeterministically(`Business Analyst\nRequired qualifications\n• SQL and Tableau experience\n• 3+ years of analytics experience\nPreferred qualifications\n• Python and Agile experience\nResponsibilities\n• Partner with product stakeholders to define metrics`);

    expect(job.requiredSkills).toEqual(expect.arrayContaining(["SQL", "Tableau"]));
    expect(job.preferredSkills).toEqual(expect.arrayContaining(["Python", "Agile"]));
    expect(job.requirements.map(item => item.name)).toContain("3+ years of analytics experience");
    expect(job.requirements.map(item => item.name)).not.toContain("Required qualifications");
    expect(job.requirements.map(item => item.name)).not.toContain("Preferred qualifications");
  });

  it("treats documented years of experience as evidence for a numeric JD requirement without altering the requirement wording", () => {
    const resume = parseResumeDeterministically(`Avery Morgan\n\nPROFESSIONAL SUMMARY\nData analyst with five years of experience building Tableau dashboards and SQL reporting.\n\nEXPERIENCE\nData Analyst | Northstar\n• Built recurring Tableau dashboards for revenue reporting.\n\nSKILLS\nSQL, Tableau\n\nEDUCATION\nB.S. Information Systems`);
    const job = parseJobDescriptionDeterministically(`Data Analyst\nRequired qualifications\n• 4+ years of data analytics experience`);
    const matches = createRequirementMatches(resume, job);
    const review = analyzeGeneratedResumeForAts(resumeText, job);

    expect(matches.find(match => match.requirement === "4+ years of data analytics experience")?.tier).toBe("exact");
    expect(matches.find(match => match.requirement === "4+ years of data analytics experience")?.explanation).toContain("meets this requirement");
    expect(review.recommendations.join(" ")).not.toContain("4+ Years");
  });
});
