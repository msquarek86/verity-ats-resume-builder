import { describe, expect, it } from "vitest";
import { renderStructuredDocxResume, renderStructuredPdfResume } from "./resumeExport";
import type { ResumeDocumentModel } from "./resumeTemplate";

const model: ResumeDocumentModel = {
  name: "Avery Morgan",
  contact: "avery@example.com  |  555-0100  |  Seattle, WA",
  template: "modern",
  sections: [
    { heading: "PROFESSIONAL SUMMARY", lines: ["Data analyst with SQL and Tableau experience."] },
    { heading: "EXPERIENCE", lines: ["Data Analyst", "Northstar | 2022 — Present", "• Built reporting dashboards."] },
    { heading: "SKILLS", lines: ["SQL • Tableau"] },
  ],
};

describe("structured resume exports", () => {
  it("creates a real PDF artifact with a PDF signature", async () => {
    const blob = renderStructuredPdfResume(model);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    expect(blob.size).toBeGreaterThan(700);
  });

  it("creates a non-empty DOCX artifact from the same structured model", async () => {
    const blob = await renderStructuredDocxResume(model);
    expect(blob.type).toContain("application");
    expect(blob.size).toBeGreaterThan(1000);
  });
});
