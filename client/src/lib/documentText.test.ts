import { describe, expect, it } from "vitest";
import { countDocumentWords, normalizeExtractedText } from "./documentText";

describe("document text cleanup", () => {
  it("normalizes extracted PDF or DOCX text while preserving readable line breaks", () => {
    const text = normalizeExtractedText(" Avery\u00a0Morgan\r\n\r\n\r\nEXPERIENCE   \r\n  • Built  dashboards  ");
    expect(text).toBe("Avery Morgan\n\nEXPERIENCE\n• Built dashboards");
    expect(countDocumentWords(text)).toBe(6);
  });
});
