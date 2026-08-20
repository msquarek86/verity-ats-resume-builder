import { File } from "node:buffer";
import { jsPDF } from "jspdf";
import { describe, expect, it, vi } from "vitest";
import { extractDocumentText } from "./documentExtraction";

vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({ value: "Avery Morgan\nPROFESSIONAL SUMMARY\nData analyst with SQL and Tableau experience supporting weekly reporting workflows for commercial operations teams.\nEXPERIENCE\nBuilt recurring dashboards for operational leaders." }),
  },
}));

describe("browser document extraction", () => {
  it("extracts a reviewable text preview from an uploaded DOCX resume", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "avery-resume.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    const extracted = await extractDocumentText(file);

    expect(extracted.fileType).toBe("DOCX");
    expect(extracted.fileName).toBe("avery-resume.docx");
    expect(extracted.text).toContain("Avery Morgan");
    expect(extracted.text).toContain("SQL and Tableau");
    expect(extracted.wordCount).toBeGreaterThan(18);
  });

  it("extracts selectable text and page metadata from an uploaded PDF resume", async () => {
    const pdf = new jsPDF();
    pdf.text([
      "Avery Morgan",
      "PROFESSIONAL SUMMARY",
      "Data analyst with SQL and Tableau experience supporting reporting workflows for product and commercial teams.",
      "EXPERIENCE",
      "Built recurring dashboards and communicated findings to stakeholders.",
    ], 20, 20);
    const blob = pdf.output("blob");
    const file = new File([await blob.arrayBuffer()], "avery-resume.pdf", { type: "application/pdf" });

    const extracted = await extractDocumentText(file);

    expect(extracted.fileType).toBe("PDF");
    expect(extracted.pageCount).toBe(1);
    expect(extracted.text).toContain("Avery Morgan");
    expect(extracted.text).toContain("SQL and Tableau");
    expect(extracted.wordCount).toBeGreaterThan(18);
  });
});
