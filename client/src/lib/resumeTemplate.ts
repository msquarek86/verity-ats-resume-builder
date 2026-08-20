export type ResumeTemplateName = "classic" | "modern" | "technical" | "minimal";

export type ResumeDocumentModel = {
  name: string;
  contact: string;
  template: ResumeTemplateName;
  sections: Array<{ heading: string; lines: string[] }>;
};

export const templateThemes: Record<ResumeTemplateName, { accent: string; ink: string; muted: string; rule: string }> = {
  classic: { accent: "#1d2521", ink: "#1d2521", muted: "#647168", rule: "#a8b0aa" },
  modern: { accent: "#1f5d48", ink: "#183228", muted: "#5d7165", rule: "#8fb8a0" },
  technical: { accent: "#1d5270", ink: "#1d2d36", muted: "#526775", rule: "#85a7bb" },
  minimal: { accent: "#59615d", ink: "#222725", muted: "#707975", rule: "#c4c9c5" },
};

const sectionHeadings = new Set(["PROFESSIONAL SUMMARY", "SUMMARY", "EXPERIENCE", "PROFESSIONAL EXPERIENCE", "WORK EXPERIENCE", "SKILLS", "TECHNICAL SKILLS", "EDUCATION", "CERTIFICATIONS", "PROJECTS"]);

function standardHeading(value: string) {
  const heading = value.trim().toUpperCase();
  if (heading === "SUMMARY") return "PROFESSIONAL SUMMARY";
  if (heading === "PROFESSIONAL EXPERIENCE" || heading === "WORK EXPERIENCE") return "EXPERIENCE";
  if (heading === "TECHNICAL SKILLS") return "SKILLS";
  return heading;
}

export function isBulletLine(value: string) {
  return /^[-•*]\s+/.test(value.trim());
}

export function buildResumeDocumentModel(
  resume: { candidate: { name: string; email: string; phone: string; location: string }; summary: string; experience: Array<{ title: string; company: string; dates: string; bullets: string[] }>; skills: string[]; education: string[] },
  optimizedText: string,
  template: ResumeTemplateName,
): ResumeDocumentModel {
  const parsedSections: Array<{ heading: string; lines: string[] }> = [];
  let active: { heading: string; lines: string[] } | null = null;
  optimizedText.split(/\r?\n/).map(line => line.trim()).forEach(line => {
    const heading = standardHeading(line);
    if (sectionHeadings.has(heading)) {
      active = { heading, lines: [] };
      parsedSections.push(active);
    } else if (active && line) {
      active.lines.push(line);
    }
  });

  const fallbackSections = [
    resume.summary ? { heading: "PROFESSIONAL SUMMARY", lines: [resume.summary] } : null,
    resume.experience.length ? { heading: "EXPERIENCE", lines: resume.experience.flatMap(item => [item.title, [item.company, item.dates].filter(Boolean).join(" | "), ...item.bullets.map(bullet => `• ${bullet}`)]).filter(Boolean) } : null,
    resume.skills.length ? { heading: "SKILLS", lines: [resume.skills.join(" • ")] } : null,
    resume.education.length ? { heading: "EDUCATION", lines: resume.education } : null,
  ].filter((section): section is { heading: string; lines: string[] } => Boolean(section));

  return {
    name: resume.candidate.name || "Candidate",
    contact: [resume.candidate.email, resume.candidate.phone, resume.candidate.location].filter(Boolean).join("  |  "),
    template,
    sections: parsedSections.length ? parsedSections : fallbackSections,
  };
}
