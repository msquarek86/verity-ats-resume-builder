import { mkdir, writeFile } from "node:fs/promises";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

const outputDir = "/home/ubuntu/webdev-static-assets/verity-upload-fixtures";
const lines = [
  "Avery Morgan",
  "avery.morgan@example.com | Seattle, WA | (555) 014-0123",
  "",
  "PROFESSIONAL SUMMARY",
  "Data analyst with five years of experience using SQL, Python, and Tableau to build reporting for operations and product teams.",
  "",
  "EXPERIENCE",
  "Data Analyst | Northstar Commerce | 2022 — Present",
  "• Built recurring Tableau dashboards for revenue, retention, and customer performance reporting.",
  "• Wrote SQL queries and Python scripts to combine weekly performance data from multiple operational systems.",
  "• Partnered with operations and finance teams to define reporting requirements and communicate findings.",
  "",
  "SKILLS",
  "SQL, Python, Tableau, Excel, Dashboard reporting, Stakeholder communication",
  "",
  "EDUCATION",
  "B.S. Information Systems, University of Washington",
];

await mkdir(outputDir, { recursive: true });

const docx = new Document({
  sections: [{ children: lines.map(line => new Paragraph({ children: [new TextRun(line || " ")] })) }],
});
await writeFile(`${outputDir}/synthetic-avery-resume.docx`, Buffer.from(await Packer.toBuffer(docx)));

const pdf = new jsPDF();
let y = 18;
lines.forEach(line => {
  const wrapped = pdf.splitTextToSize(line || " ", 170);
  pdf.text(wrapped, 18, y);
  y += Math.max(wrapped.length, 1) * 6;
});
await writeFile(`${outputDir}/synthetic-avery-resume.pdf`, Buffer.from(pdf.output("arraybuffer")));
