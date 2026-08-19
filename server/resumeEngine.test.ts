import { describe, expect, it } from "vitest";
import { calculateAtsScore, createRequirementMatches, parseJobDescriptionDeterministically, parseResumeDeterministically, runQualityGate, validateClaims } from "./resumeEngine";

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
});
