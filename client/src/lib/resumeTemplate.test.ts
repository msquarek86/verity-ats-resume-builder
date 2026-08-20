import { describe, expect, it } from "vitest";
import { buildResumeDocumentModel } from "./resumeTemplate";

const resume = {
  candidate: { name: "Avery Morgan", email: "avery@example.com", phone: "555-0100", location: "Seattle, WA" },
  summary: "Data analyst with SQL and Tableau experience.",
  experience: [{ title: "Data Analyst", company: "Northstar", dates: "2022 — Present", bullets: ["Built reporting dashboards."] }],
  skills: ["SQL", "Tableau"],
  education: ["B.S. Information Systems"],
};

describe("structured ATS template model", () => {
  it("turns a tailored resume into conventional sections rather than a plain text dump", () => {
    const model = buildResumeDocumentModel(resume, "Avery Morgan\n\nPROFESSIONAL SUMMARY\nData analyst with SQL and Tableau experience.\n\nEXPERIENCE\nData Analyst\nNorthstar | 2022 — Present\n• Built reporting dashboards.\n\nSKILLS\nSQL • Tableau\n\nEDUCATION\nB.S. Information Systems", "modern");
    expect(model.name).toBe("Avery Morgan");
    expect(model.template).toBe("modern");
    expect(model.sections.map(section => section.heading)).toEqual(["PROFESSIONAL SUMMARY", "EXPERIENCE", "SKILLS", "EDUCATION"]);
    expect(model.sections[1]?.lines).toContain("• Built reporting dashboards.");
  });
});
