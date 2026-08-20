import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import { isBulletLine, templateThemes, type ResumeDocumentModel } from "./resumeTemplate";

export function renderStructuredPdfResume(model: ResumeDocumentModel) {
  const theme = templateThemes[model.template];
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const lineWidth = 504;
  let y = 58;
  const ensureSpace = (height: number) => {
    if (y + height > 735) {
      pdf.addPage();
      y = 58;
    }
  };
  const writeLines = (text: string, x: number, width: number, size: number, leading: number) => {
    const wrapped = pdf.splitTextToSize(text, width) as string[];
    ensureSpace(wrapped.length * leading + 4);
    pdf.setFontSize(size);
    pdf.text(wrapped, x, y);
    y += wrapped.length * leading + 4;
  };

  pdf.setTextColor(theme.ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(model.name, margin, y);
  y += 22;
  if (model.contact) {
    pdf.setTextColor(theme.muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.text(model.contact, margin, y);
    y += 18;
  }
  pdf.setDrawColor(theme.rule);
  pdf.setLineWidth(0.8);
  pdf.line(margin, y, margin + lineWidth, y);
  y += 18;

  model.sections.forEach(section => {
    ensureSpace(32);
    pdf.setTextColor(theme.accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(section.heading, margin, y);
    y += 6;
    pdf.setDrawColor(theme.rule);
    pdf.setLineWidth(0.45);
    pdf.line(margin, y, margin + lineWidth, y);
    y += 14;
    section.lines.forEach((line, index) => {
      pdf.setTextColor(theme.ink);
      const bullet = isBulletLine(line);
      if (bullet) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text("•", margin + 2, y);
        writeLines(line.replace(/^[-•*]\s+/, ""), margin + 14, lineWidth - 14, 10, 13);
      } else {
        const isExperienceLabel = section.heading === "EXPERIENCE" && index % 2 === 0 && index + 1 < section.lines.length && !isBulletLine(section.lines[index + 1] ?? "");
        pdf.setFont("helvetica", isExperienceLabel ? "bold" : "normal");
        writeLines(line, margin, lineWidth, isExperienceLabel ? 10 : 9.8, 13);
      }
    });
    y += 8;
  });
  return pdf.output("blob");
}

export async function renderStructuredDocxResume(model: ResumeDocumentModel) {
  const theme = templateThemes[model.template];
  const color = (value: string) => value.replace("#", "");
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 70 }, children: [new TextRun({ text: model.name, bold: true, size: 34, color: color(theme.ink), font: "Aptos Display" })] }),
    ...(model.contact ? [new Paragraph({ spacing: { after: 130 }, children: [new TextRun({ text: model.contact, size: 18, color: color(theme.muted), font: "Aptos" })] })] : []),
  ];
  model.sections.forEach(section => {
    children.push(new Paragraph({ border: { bottom: { color: color(theme.rule), style: BorderStyle.SINGLE, size: 7, space: 2 } }, spacing: { before: 115, after: 70 }, children: [new TextRun({ text: section.heading, bold: true, size: 19, color: color(theme.accent), font: "Aptos" })] }));
    section.lines.forEach((line, index) => {
      const bullet = isBulletLine(line);
      const isExperienceLabel = section.heading === "EXPERIENCE" && index % 2 === 0 && index + 1 < section.lines.length && !isBulletLine(section.lines[index + 1] ?? "");
      children.push(new Paragraph({ bullet: bullet ? { level: 0 } : undefined, spacing: { after: bullet ? 42 : 26 }, children: [new TextRun({ text: line.replace(/^[-•*]\s+/, ""), bold: isExperienceLabel, size: 19, color: color(theme.ink), font: "Aptos" })] }));
    });
  });
  const document = new Document({ sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] });
  return Packer.toBlob(document);
}
