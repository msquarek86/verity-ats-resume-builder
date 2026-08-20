import { countDocumentWords, normalizeExtractedText } from "./documentText";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type ExtractedDocument = {
  fileName: string;
  fileType: "PDF" | "DOCX" | "TXT";
  text: string;
  pageCount?: number;
  wordCount: number;
  warning?: string;
};

async function extractPdfText(file: File) {
  const pdfjsLib = typeof window === "undefined"
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");
  if (typeof window !== "undefined") pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data });
  const pdf = await task.promise;
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const page = await pdf.getPage(index + 1);
    const content = await page.getTextContent();
    let currentLine = "";
    const extractedLines: string[] = [];
    content.items.forEach(item => {
      if (!("str" in item)) return;
      const textItem = item as { str: string; hasEOL?: boolean };
      currentLine += `${currentLine ? " " : ""}${textItem.str}`;
      if (textItem.hasEOL) {
        extractedLines.push(currentLine);
        currentLine = "";
      }
    });
    if (currentLine) extractedLines.push(currentLine);
    return extractedLines.join("\n");
  }));
  return { text: pages.join("\n\n"), pageCount: pdf.numPages };
}

export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.size > 7 * 1024 * 1024) throw new Error("Choose a document smaller than 7 MB so it can be read safely in your browser.");

  let rawText = "";
  let pageCount: number | undefined;
  let fileType: ExtractedDocument["fileType"];
  if (extension === "txt") {
    rawText = await file.text();
    fileType = "TXT";
  } else if (extension === "docx") {
    const mammoth = (await import("mammoth")).default;
    rawText = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    fileType = "DOCX";
  } else if (extension === "pdf") {
    const extracted = await extractPdfText(file);
    rawText = extracted.text;
    pageCount = extracted.pageCount;
    fileType = "PDF";
  } else {
    throw new Error("Choose a PDF, DOCX, or TXT file.");
  }

  const text = normalizeExtractedText(rawText);
  const wordCount = countDocumentWords(text);
  if (wordCount < 18) {
    throw new Error("Very little selectable text was found. This may be a scanned or image-only file; use a text-based PDF/DOCX, or paste the text after OCR.");
  }
  return {
    fileName: file.name,
    fileType,
    text,
    pageCount,
    wordCount,
    warning: fileType === "PDF" && wordCount < 80 ? "This PDF produced limited selectable text. Review the extracted content before analysis." : undefined,
  };
}
