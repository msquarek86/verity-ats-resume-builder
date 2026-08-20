import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Check, ChevronRight, Download, FileCheck2, FileText, FileWarning, FolderHeart, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Upload, WandSparkles } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import { extractDocumentText, type ExtractedDocument } from "@/lib/documentExtraction";
import { buildResumeDocumentModel, isBulletLine, templateThemes, type ResumeDocumentModel, type ResumeTemplateName } from "@/lib/resumeTemplate";

type Settings = {
  targetRole: string;
  targetCompany: string;
  tone: "concise" | "confident" | "executive";
  seniority: "entry" | "mid" | "senior" | "executive";
  pageLength: "one" | "two";
  template: "classic" | "modern" | "technical" | "minimal";
  optimizationLevel: "balanced" | "focused" | "maximum";
  includeSummary: boolean;
  includeProjects: boolean;
  includeCertifications: boolean;
  strictTruthMode: boolean;
};

const initialSettings: Settings = { targetRole: "", targetCompany: "", tone: "confident", seniority: "mid", pageLength: "one", template: "modern", optimizationLevel: "balanced", includeSummary: true, includeProjects: true, includeCertifications: true, strictTruthMode: true };

const sampleResume = `Avery Morgan
avery.morgan@email.com | Seattle, WA | (555) 014-0123

PROFESSIONAL SUMMARY
Data analyst with 5 years of experience turning operational data into accessible reporting for business teams. Experienced with SQL, Python, Tableau, and cross-functional communication.

EXPERIENCE
Data Analyst | Northstar Commerce | 2022 — Present
• Built recurring Tableau dashboards for revenue, retention, and customer performance reporting.
• Wrote SQL queries and Python scripts to combine weekly performance data from multiple operational systems.
• Partnered with operations and finance teams to define reporting requirements and present findings.

Business Intelligence Analyst | Pioneer Retail | 2019 — 2022
• Created Excel-based reporting workflows that reduced manual weekly report preparation.
• Analyzed customer purchase trends and delivered findings to commercial stakeholders.

SKILLS
SQL, Python, Tableau, Excel, Data analysis, Dashboard reporting, Stakeholder communication, Git

EDUCATION
B.S. Information Systems, University of Washington`;

const sampleJobDescription = `Senior Data Analyst — Growth Analytics

We are seeking a Senior Data Analyst to build data products that help product and commercial teams make stronger decisions.

Required qualifications
• 4+ years of analytics experience with advanced SQL and data visualization.
• Experience creating dashboards in Tableau or Power BI and communicating findings to stakeholders.
• Strong analytical problem-solving, business partnering, and cross-functional collaboration skills.
• Ability to define metrics, analyze customer behavior, and translate results into clear recommendations.

Preferred qualifications
• Python experience and familiarity with experimentation or product analytics.
• Experience working in an Agile environment.`;

const readableTier: Record<string, string> = { exact: "Exact", semantic: "Semantic", related: "Related", insufficient: "Gap" };
type ApplicationStatus = "draft" | "ready" | "applied" | "screening" | "interview" | "offer" | "rejected" | "withdrawn";
const applicationStatuses: Array<{ value: ApplicationStatus; label: string }> = [{ value: "draft", label: "Draft" }, { value: "ready", label: "Ready to apply" }, { value: "applied", label: "Applied" }, { value: "screening", label: "Screening" }, { value: "interview", label: "Interview" }, { value: "offer", label: "Offer" }, { value: "rejected", label: "Not selected" }, { value: "withdrawn", label: "Withdrawn" }];

function words(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function formatTier(value: string) { return `badge-${value}`; }

function renderPdfResume(model: ResumeDocumentModel) {
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

async function renderDocxResume(model: ResumeDocumentModel) {
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

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [message, setMessage] = useState("");
  const [masterId, setMasterId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState("intake");
  const [preparedExport, setPreparedExport] = useState<{ url: string; fileName: string; label: string } | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<{ resume?: ExtractedDocument; job?: ExtractedDocument }>({});
  const { isAuthenticated, loading: authLoading } = useAuth();
  const analysis = trpc.resume.analyze.useMutation();
  const saveMaster = trpc.resume.saveMaster.useMutation();
  const saveVersion = trpc.resume.saveVersion.useMutation();
  const versions = trpc.resume.listVersions.useQuery(undefined, { enabled: isAuthenticated });
  const updateApplication = trpc.resume.updateApplication.useMutation();

  const result = analysis.data;
  const stage = result ? "review" : activeView;
  const stats = useMemo(() => result ? {
    exact: result.matches.filter(match => match.tier === "exact").length,
    gaps: result.matches.filter(match => match.tier === "insufficient").length,
  } : null, [result]);
  const templateModel = useMemo(() => result ? buildResumeDocumentModel(result.resume, result.optimizedText, result.settings.template as ResumeTemplateName) : null, [result]);
  const matchForKeyword = (keyword: string) => result?.matches.find(match => match.requirement.toLowerCase() === keyword.toLowerCase());
  const requiredKeywordTerms = result ? result.job.requirements.filter(item => item.category === "skill" && item.priority !== "medium").map(item => item.name) : [];
  const preferredKeywordTerms = result ? result.job.requirements.filter(item => item.category === "skill" && item.priority === "medium").map(item => item.name) : [];

  const changeSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(previous => ({ ...previous, [key]: value }));

  const loadExample = () => {
    setResumeText(sampleResume);
    setJobDescription(sampleJobDescription);
    setSettings(previous => ({ ...previous, targetRole: "Senior Data Analyst", targetCompany: "Growth Analytics" }));
    setMessage("Guided example loaded. You can replace it with your own documents before analysis.");
    setActiveView("intake");
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>, target: "resume" | "job") => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setMessage("Reading your document…");
      const extracted = await extractDocumentText(file);
      if (target === "resume") setResumeText(extracted.text);
      else setJobDescription(extracted.text);
      setUploadedDocuments(previous => ({ ...previous, [target]: extracted }));
      setMessage(`${extracted.fileName} was extracted. Review the preview before analysis${extracted.warning ? " — limited text may need correction." : "."}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not read that document.");
    } finally {
      event.target.value = "";
    }
  };

  const analyze = async () => {
    setMessage("");
    try {
      await analysis.mutateAsync({ resumeText, jobDescription, settings: { ...settings, strictTruthMode: true } });
      setActiveView("review");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis could not be completed. Please check your inputs and try again.");
    }
  };

  const saveAsMaster = async () => {
    if (!result) return;
    try {
      const saved = await saveMaster.mutateAsync({ label: result.resume.candidate.name ? `${result.resume.candidate.name} — Master Resume` : "Master Resume", sourceText: resumeText, structuredData: result.resume });
      setMasterId(saved.id);
      setMessage("Master resume saved separately. Tailored versions will never overwrite it.");
    } catch {
      setMessage("Sign in to securely save your master resume and job-specific versions.");
    }
  };

  const saveTailoredVersion = async () => {
    if (!result) return;
    if (!masterId) { await saveAsMaster(); return; }
    try {
      await saveVersion.mutateAsync({ masterResumeId: masterId, label: `${settings.targetRole || result.job.title} — Tailored`, targetRole: settings.targetRole || result.job.title, targetCompany: settings.targetCompany || result.job.company, jobDescription, settings: result.settings, analysis: result, qualityGate: result.qualityGate, resumeText: result.optimizedText, applicationStatus: "ready" });
      await versions.refetch();
      setMessage("Tailored version saved. Your master resume remains unchanged.");
    } catch {
      setMessage("Sign in to save this tailored version.");
    }
  };

  const updateApplicationStatus = async (id: number, input: { applicationStatus?: ApplicationStatus; applicationPlatform?: string | null; applicationUrl?: string | null; appliedAt?: number | null; applicationNotes?: string | null }) => {
    const version = versions.data?.find(item => item.id === id);
    if (!version) return;
    try {
      await updateApplication.mutateAsync({ id, applicationStatus: input.applicationStatus ?? version.applicationStatus, applicationPlatform: input.applicationPlatform ?? version.applicationPlatform, applicationUrl: input.applicationUrl ?? version.applicationUrl, appliedAt: input.appliedAt === undefined ? (version.appliedAt ? new Date(version.appliedAt).getTime() : null) : input.appliedAt, applicationNotes: input.applicationNotes ?? version.applicationNotes });
      await versions.refetch();
      setMessage("Application tracker updated.");
    } catch {
      setMessage("We could not update this application tracker entry.");
    }
  };
  const recheckBeforeExport = async () => {
    const latest = await analysis.mutateAsync({ resumeText, jobDescription, settings: { ...settings, strictTruthMode: true } });
    if (!latest.qualityGate.ready) {
      setMessage("The quality gate found an export-blocking evidence issue. Review the flagged claims before exporting.");
      return null;
    }
    return latest;
  };
  const prepareExport = (blob: Blob, fileName: string, label: string) => {
    const url = URL.createObjectURL(blob);
    setPreparedExport(previous => {
      if (previous) URL.revokeObjectURL(previous.url);
      return { url, fileName, label };
    });
    setMessage(`Quality gate reran successfully. Your ${label} export is prepared for download.`);
  };
  const exportText = async () => {
    try {
      const latest = await recheckBeforeExport();
      if (latest) prepareExport(new Blob([latest.optimizedText], { type: "text/plain;charset=utf-8" }), "tailored-resume.txt", "text");
    } catch { setMessage("The quality gate could not run. Please try the export again."); }
  };
  const exportPdf = async () => {
    try {
      const latest = await recheckBeforeExport();
      if (!latest) return;
    const { renderStructuredPdfResume } = await import("@/lib/resumeExport");
    const model = buildResumeDocumentModel(latest.resume, latest.optimizedText, latest.settings.template as ResumeTemplateName);
    prepareExport(renderStructuredPdfResume(model), "tailored-resume.pdf", "ATS-ready PDF");
    } catch { setMessage("The quality gate could not run. Please try the export again."); }
  };
  const exportDocx = async () => {
    try {
      const latest = await recheckBeforeExport();
      if (!latest) return;
      const { renderStructuredDocxResume } = await import("@/lib/resumeExport");
      const model = buildResumeDocumentModel(latest.resume, latest.optimizedText, latest.settings.template as ResumeTemplateName);
      prepareExport(await renderStructuredDocxResume(model), "tailored-resume.docx", "ATS-ready DOCX");
    } catch { setMessage("The quality gate could not run. Please try the export again."); }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">V</span> Verity</div>
        <div className="topbar-note"><span className="privacy-dot" /> Evidence-first resume optimization</div>
      </header>

      <main className="workspace">
        <section className="hero">
          <div>
            <p className="eyebrow">A clearer route to the right role</p>
            <h1>Tailor your resume with <em>proof,</em> not promises.</h1>
          </div>
          <p className="hero-copy">Translate real experience into a focused, ATS-conscious resume—without inventing a single claim.</p>
        </section>

        <section className="truth-banner" aria-label="Strict Truth Mode enabled">
          <div className="truth-icon"><ShieldCheck size={16} /></div>
          <div><strong>Strict Truth Mode is on by default.</strong><p>Every proposed statement is linked to source evidence. Gaps are invitations to add real proof—not instructions to fabricate it.</p></div>
        </section>

        <nav className="stepper" aria-label="Resume workflow">
          {[{ id: "intake", label: "Resume & role" }, { id: "intelligence", label: "Job intelligence" }, { id: "review", label: "Match & tailor" }, { id: "export", label: "Quality & export" }].map((item, index) => (
            <button key={item.id} className={`step ${stage === item.id || (result && item.id !== "intake") ? "active" : ""}`} onClick={() => result ? setActiveView(item.id) : setActiveView("intake")}>
              <span className="step-number">{result && index < 3 ? <Check size={12} /> : index + 1}</span>{item.label}
            </button>
          ))}
        </nav>

        <div className="grid-main">
          <section className="panel">
            <header className="panel-header">
              <div><p className="panel-kicker">01 / Source material</p><h2 className="panel-title">Start with the facts.</h2><p className="panel-subtitle">Paste or upload a resume and the job description you want to pursue.</p></div>
              <FileText size={19} color="#1f5d48" />
            </header>
            <div className="panel-body">
              <div className="intake-grid">
                <div className="input-card">
                  <div className="input-label"><span>Your master resume</span><span className="mini-label">{uploadedDocuments.resume?.fileType || "SOURCE"}</span></div>
                  <textarea className="resume-textarea" value={resumeText} onChange={event => setResumeText(event.target.value)} placeholder="Upload a PDF or DOCX, or paste your existing resume…" aria-label="Master resume text" />
                  {uploadedDocuments.resume && <div className={`extraction-card ${uploadedDocuments.resume.warning ? "limited" : ""}`}><FileCheck2 size={14} /><div><strong>{uploadedDocuments.resume.fileName}</strong><span>{uploadedDocuments.resume.fileType}{uploadedDocuments.resume.pageCount ? ` · ${uploadedDocuments.resume.pageCount} page${uploadedDocuments.resume.pageCount === 1 ? "" : "s"}` : ""} · {uploadedDocuments.resume.wordCount} words extracted</span>{uploadedDocuments.resume.warning && <em><FileWarning size={11} /> {uploadedDocuments.resume.warning}</em>}</div><button className="quiet-button" type="button" onClick={() => { setUploadedDocuments(previous => ({ ...previous, resume: undefined })); setResumeText(""); }}>Replace</button></div>}
                  <div className="input-footer"><label className="file-upload"><Upload size={13} /> Upload resume PDF, DOCX, or TXT<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => handleUpload(event, "resume")} /></label><span className="word-count">{words(resumeText)} words</span></div>
                </div>
                <div className="input-card">
                  <div className="input-label"><span>Target job description</span><span className="mini-label">{uploadedDocuments.job?.fileType || "CONTEXT"}</span></div>
                  <textarea className="resume-textarea" value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Upload the job PDF/DOCX, or paste the complete job description…" aria-label="Job description text" />
                  {uploadedDocuments.job && <div className={`extraction-card ${uploadedDocuments.job.warning ? "limited" : ""}`}><FileCheck2 size={14} /><div><strong>{uploadedDocuments.job.fileName}</strong><span>{uploadedDocuments.job.fileType}{uploadedDocuments.job.pageCount ? ` · ${uploadedDocuments.job.pageCount} page${uploadedDocuments.job.pageCount === 1 ? "" : "s"}` : ""} · {uploadedDocuments.job.wordCount} words extracted</span>{uploadedDocuments.job.warning && <em><FileWarning size={11} /> {uploadedDocuments.job.warning}</em>}</div><button className="quiet-button" type="button" onClick={() => { setUploadedDocuments(previous => ({ ...previous, job: undefined })); setJobDescription(""); }}>Replace</button></div>}
                  <div className="input-footer"><label className="file-upload"><Upload size={13} /> Upload job PDF, DOCX, or TXT<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => handleUpload(event, "job")} /></label><span className="word-count">{words(jobDescription)} words</span></div>
                </div>
              </div>
              <div className="action-row">
                <div><button className="sample-link" onClick={loadExample}>Load a guided example</button><p className="upload-assurance">Upload first, then review the extracted text before analysis. Text is never silently invented from a document.</p></div>
                <button className="primary-button" onClick={analyze} disabled={analysis.isPending || words(resumeText) < 20 || words(jobDescription) < 20}>{analysis.isPending ? <><RefreshCw size={14} className="animate-spin" /> Analyzing evidence…</> : <><Sparkles size={14} /> Analyze & tailor <ChevronRight size={14} /></>}</button>
              </div>
              {message && <p className={`toast-message ${message.includes("saved") ? "save-success" : ""}`}>{message}</p>}
            </div>
          </section>

          <aside className="panel settings-panel">
            <header className="panel-header"><div><p className="panel-kicker">Tailoring controls</p><h2 className="panel-title">Set the direction.</h2></div><WandSparkles size={18} color="#1f5d48" /></header>
            <div className="settings-body">
              <div className="field"><label className="field-label">Target job title</label><input className="text-input" value={settings.targetRole} onChange={event => changeSetting("targetRole", event.target.value)} placeholder="e.g., Senior Data Analyst" /></div>
              <div className="field"><label className="field-label">Target company</label><input className="text-input" value={settings.targetCompany} onChange={event => changeSetting("targetCompany", event.target.value)} placeholder="Optional" /></div>
              <div className="settings-two-col">
                <div className="field"><label className="field-label">Tone</label><select className="select-input" value={settings.tone} onChange={event => changeSetting("tone", event.target.value as Settings["tone"])}><option value="concise">Concise</option><option value="confident">Confident</option><option value="executive">Executive</option></select></div>
                <div className="field"><label className="field-label">Seniority</label><select className="select-input" value={settings.seniority} onChange={event => changeSetting("seniority", event.target.value as Settings["seniority"])}><option value="entry">Entry</option><option value="mid">Mid-level</option><option value="senior">Senior</option><option value="executive">Executive</option></select></div>
              </div>
              <div className="settings-two-col">
                <div className="field"><label className="field-label">Length</label><select className="select-input" value={settings.pageLength} onChange={event => changeSetting("pageLength", event.target.value as Settings["pageLength"])}><option value="one">One page</option><option value="two">Two pages</option></select></div>
                <div className="field"><label className="field-label">Template</label><select className="select-input" value={settings.template} onChange={event => changeSetting("template", event.target.value as Settings["template"])}><option value="modern">Modern</option><option value="classic">Classic</option><option value="technical">Technical</option><option value="minimal">Minimal</option></select><small className="field-hint">Single-column and ATS-safe.</small></div>
              </div>
              <div className="field"><label className="field-label">Keyword optimization</label><select className="select-input" value={settings.optimizationLevel} onChange={event => changeSetting("optimizationLevel", event.target.value as Settings["optimizationLevel"])}><option value="balanced">Balanced</option><option value="focused">Focused</option><option value="maximum">Maximum supported coverage</option></select></div>
              <div className="toggle-list">
                <label className="toggle-row"><span>Strict Truth Mode<small>Always enabled for all output.</small></span><span className="switch"><input type="checkbox" checked readOnly /><i className="switch-track" /></span></label>
                <label className="toggle-row"><span>Professional summary</span><span className="switch"><input type="checkbox" checked={settings.includeSummary} onChange={event => changeSetting("includeSummary", event.target.checked)} /><i className="switch-track" /></span></label>
                <label className="toggle-row"><span>Include projects</span><span className="switch"><input type="checkbox" checked={settings.includeProjects} onChange={event => changeSetting("includeProjects", event.target.checked)} /><i className="switch-track" /></span></label>
                <label className="toggle-row"><span>Include certifications</span><span className="switch"><input type="checkbox" checked={settings.includeCertifications} onChange={event => changeSetting("includeCertifications", event.target.checked)} /><i className="switch-track" /></span></label>
              </div>
            </div>
          </aside>
        </div>

        <section className="panel tracker-panel" id="versions">
          <header className="panel-header"><div><p className="panel-kicker">Application tracker</p><h2 className="panel-title">Keep each tailored version in context.</h2><p className="panel-subtitle">Save a tailored resume, record where it was used, and follow the application status without changing your master resume.</p></div><FolderHeart size={19} color="#1f5d48" /></header>
          <div className="panel-body">
            {authLoading ? <p className="tracker-message">Loading your saved versions…</p> : !isAuthenticated ? <div className="tracker-empty"><strong>Sign in to save versions and track applications.</strong><p>Your master resume stays separate while each job-specific version gets its own status history.</p><button className="secondary-button" onClick={startLogin}>Sign in to enable tracking</button></div> : versions.isLoading ? <p className="tracker-message">Loading your saved versions…</p> : !versions.data?.length ? <div className="tracker-empty"><strong>No tailored versions saved yet.</strong><p>Analyze a role, then select <em>Save master first</em> and save the tailored version to start tracking applications.</p></div> : <div className="application-list">{versions.data.map(version => <article className="application-card" key={version.id}><div className="application-heading"><div><strong>{version.label}</strong><p>{version.targetCompany || "Target company not specified"} · {version.targetRole}</p></div><select className="status-select" value={version.applicationStatus} disabled={updateApplication.isPending} onChange={event => void updateApplicationStatus(version.id, { applicationStatus: event.target.value as ApplicationStatus })}>{applicationStatuses.map(status => <option value={status.value} key={status.value}>{status.label}</option>)}</select></div><div className="application-fields"><label><span>Platform</span><input defaultValue={version.applicationPlatform || ""} placeholder="e.g., Workday, LinkedIn" onBlur={event => void updateApplicationStatus(version.id, { applicationPlatform: event.currentTarget.value || null })} /></label><label><span>Applied on</span><input type="date" defaultValue={version.appliedAt ? new Date(version.appliedAt).toISOString().slice(0, 10) : ""} onChange={event => void updateApplicationStatus(version.id, { appliedAt: event.currentTarget.value ? new Date(`${event.currentTarget.value}T12:00:00Z`).getTime() : null })} /></label><label className="application-notes"><span>Notes</span><input defaultValue={version.applicationNotes || ""} placeholder="e.g., Referral submitted; follow up next week" onBlur={event => void updateApplicationStatus(version.id, { applicationNotes: event.currentTarget.value || null })} /></label></div></article>)}</div>}
          </div>
        </section>

        {!result && !analysis.isPending && <section className="panel" style={{ marginTop: 24 }}><div className="empty-state"><div className="empty-orb"><Sparkles size={20} /></div><h3>Your evidence map will appear here.</h3><p>We will identify supported experience, distinguish adjacent skills from true matches, and surface gaps without overstating your qualifications.</p></div></section>}
        {analysis.isPending && <section className="panel results"><div className="loading-screen"><div className="loading-ring" /><h3>Building an evidence map…</h3><p>We are extracting source facts, reading the role, and checking every proposed claim against your resume.</p></div></section>}

        {result && <section className="results">
          <section className="panel score-panel" id="review">
            <div className="score-hero"><div><p className="panel-kicker">Estimated compatibility</p><div className="score-figure">{result.score.score}<span>/100</span></div><p className="score-label">{result.score.label}</p></div><p className="score-footnote">An internal optimization estimate—never a guarantee of any employer’s ATS outcome.</p></div>
            <div className="score-content"><h3>What the score actually means.</h3><p>{stats?.exact ?? 0} direct match{stats?.exact === 1 ? "" : "es"} and {stats?.gaps ?? 0} evidence gap{stats?.gaps === 1 ? "" : "s"} were found against the analyzed requirements.</p><div className="score-breakdown">{result.score.breakdown.map(item => <div className="score-row" key={item.key}><label>{item.label}</label><strong>{item.score}%</strong><div className="progress-bar"><span style={{ width: `${item.score}%` }} /></div></div>)}</div></div>
          </section>

          <section className="panel keyword-assessment" id="keywords"><header className="panel-header"><div><p className="panel-kicker">JD keyword coverage</p><h2 className="panel-title">See what this role actually asks for.</h2><p className="panel-subtitle">Exact matches, related evidence, and real gaps are calculated directly from the parsed job description.</p></div><span className="tier-badge badge-semantic">{result.job.keywords.length} target terms</span></header><div className="panel-body"><div className="keyword-groups"><div><h3>Required keywords</h3><div className="keyword-chips">{(requiredKeywordTerms.length ? requiredKeywordTerms : result.job.requiredSkills).slice(0, 12).map(keyword => { const match = matchForKeyword(keyword); return <span className={`keyword-chip ${match?.tier || "insufficient"}`} key={keyword}>{keyword}<b>{match ? readableTier[match.tier] : "Gap"}</b></span>; }) || <p className="keyword-empty">No discrete required keywords were detected; review the detailed requirement evidence below.</p>}</div></div><div><h3>Preferred keywords</h3><div className="keyword-chips">{(preferredKeywordTerms.length ? preferredKeywordTerms : result.job.preferredSkills).slice(0, 10).map(keyword => { const match = matchForKeyword(keyword); return <span className={`keyword-chip ${match?.tier || "insufficient"}`} key={keyword}>{keyword}<b>{match ? readableTier[match.tier] : "Gap"}</b></span>; }) || <p className="keyword-empty">No discrete preferred keywords were detected.</p>}</div></div></div><div className="keyword-note"><ShieldCheck size={14} /> Only exact and tightly scoped semantic matches are counted as substantive ATS coverage. Related evidence stays visible but is never promoted into an equivalent claim.</div></div></section>

          <section className="panel ats-review-panel"><header className="panel-header"><div><p className="panel-kicker">AI-assisted ATS review</p><h2 className="panel-title">Inspect the generated resume against this exact job.</h2><p className="panel-subtitle">The review reads the tailored output against the pasted job description while retaining the evidence and truth constraints used to create it.</p></div><span className="tier-badge badge-semantic">Generated review</span></header><div className="panel-body"><div className="ats-review-top"><div className="ats-review-score"><strong>{result.atsReview.score}<small>/100</small></strong><span>{result.atsReview.label}</span></div><div><p className="ats-review-summary">{result.atsReview.summary}</p><p className="ats-review-caution">{result.atsReview.caution}</p></div></div><div className="ats-review-grid"><div className="ats-review-column"><h3>Supported in the generated resume</h3>{result.atsReview.directMatches.length ? result.atsReview.directMatches.map(item => <span className="review-chip good" key={item}>{item}</span>) : <p>No direct evidence was identified.</p>}</div><div className="ats-review-column"><h3>Related, not equivalent</h3>{result.atsReview.relatedRequirements.length ? result.atsReview.relatedRequirements.map(item => <span className="review-chip related" key={item}>{item}</span>) : <p>No related-only evidence was identified.</p>}</div><div className="ats-review-column"><h3>Evidence gaps</h3>{result.atsReview.gaps.length ? result.atsReview.gaps.map(item => <span className="review-chip gap" key={item}>{item}</span>) : <p>No prioritized gaps were identified.</p>}</div></div><div className="ats-recommendations"><h3>Recommended next checks</h3>{result.atsReview.recommendations.map(item => <p key={item}>{item}</p>)}</div></div></section>

          <div className="match-grid" id="intelligence">
            <section className="panel"><header className="panel-header"><div><p className="panel-kicker">02 / Match intelligence</p><h2 className="panel-title">Evidence, not equivalence.</h2><p className="panel-subtitle">Each target requirement is graded by what your original resume actually supports.</p></div></header><div className="panel-body"><div className="match-list">{result.matches.map(match => <div className="match-row" key={match.requirementId}><span className={`tier-dot tier-${match.tier}`} /><div><div className="match-name">{match.requirement}</div><div className="match-evidence">{match.evidence[0]?.quote || match.explanation}</div></div><span className={`tier-badge ${formatTier(match.tier)}`}>{readableTier[match.tier]}</span></div>)}</div><div className="legend"><span className="legend-item"><i className="tier-dot tier-exact" />Exact evidence</span><span className="legend-item"><i className="tier-dot tier-semantic" />Curated semantic</span><span className="legend-item"><i className="tier-dot tier-related" />Related, not equivalent</span><span className="legend-item"><i className="tier-dot tier-insufficient" />Insufficient evidence</span></div></div></section>
            <section className="panel"><header className="panel-header"><div><p className="panel-kicker">Smart suggestions</p><h2 className="panel-title">Next best actions.</h2></div></header><div className="panel-body"><div className="advice-section">{result.score.improvedBy.slice(0, 2).map(item => <div className="advice-item success" key={item}><h4>Evidence already present</h4><p>{item}</p></div>)}{result.score.nextSteps.slice(0, 3).map(item => <div className="advice-item" key={item}><h4>Confirm before adding</h4><p>{item}</p></div>)}{result.score.loweredBy.length === 0 && <div className="advice-item success"><h4>Strong coverage</h4><p>Your source resume supports the major requirements identified in this role.</p></div>}</div></div></section>
          </div>

          <section className="panel"><header className="panel-header"><div><p className="panel-kicker">03 / Before & after</p><h2 className="panel-title">A transparent rewrite.</h2><p className="panel-subtitle">The tailored version prioritizes evidence from your master resume. Every claim is reviewed before export.</p></div><button className="secondary-button" onClick={saveTailoredVersion} disabled={saveVersion.isPending || saveMaster.isPending}><FolderHeart size={14} /> {masterId ? "Save version" : "Save master first"}</button></header><div className="comparison-grid"><div className="document-side"><div className="document-label"><FileText size={12} /> Source resume</div><pre className="document-text">{resumeText}</pre></div><div className="document-side"><div className="document-label"><Sparkles size={12} /> Tailored resume</div><pre className="document-text optimized">{result.optimizedText}</pre></div></div></section>

          {templateModel && <section className={`panel export-template-panel template-${templateModel.template}`}><header className="panel-header"><div><p className="panel-kicker">ATS resume template</p><h2 className="panel-title">Your exported document is structured—not a text dump.</h2><p className="panel-subtitle">This single-column layout preserves headings, hierarchy, and reading order in both the PDF and DOCX files.</p></div><span className="tier-badge badge-exact">{templateModel.template} template</span></header><div className="template-preview-wrap"><article className="template-preview"><header><h2>{templateModel.name}</h2>{templateModel.contact && <p>{templateModel.contact}</p>}</header>{templateModel.sections.map(section => <section key={section.heading}><h3>{section.heading}</h3>{section.lines.map((line, index) => isBulletLine(line) ? <p className="template-bullet" key={`${section.heading}-${index}`}>{line.replace(/^[-•*]\s+/, "")}</p> : <p className="template-line" key={`${section.heading}-${index}`}>{line}</p>)}</section>)}</article></div></section>}

          <section className="panel"><header className="panel-header"><div><p className="panel-kicker">Claim provenance</p><h2 className="panel-title">Truth Guard review.</h2><p className="panel-subtitle">Each proposed line points back to the evidence that permits it.</p></div><ShieldCheck size={19} color="#1f5d48" /></header><div className="panel-body"><div className="truth-review">{result.claims.map((claim, index) => { const issue = result.qualityGate.truthIssues.find(item => item.claim === claim.text); return <article className={`claim-card ${issue?.severity ?? ""}`} key={`${claim.section}-${index}`}><div className="claim-meta"><span>{claim.section}</span><span>{issue ? issue.severity : "Supported"}</span></div><blockquote>“{claim.text}”</blockquote><div>{claim.evidenceIds.length ? claim.evidenceIds.map(evidenceId => <span className="evidence-chip" key={evidenceId}>Source: {evidenceId}</span>) : <span className="evidence-chip">No cited source</span>}</div>{issue && <p className="claim-issue">{issue.message}</p>}</article>; })}</div></div></section>

          <section className="panel" id="export"><header className="panel-header"><div><p className="panel-kicker">04 / Final quality gate</p><h2 className="panel-title">Ready only when the evidence is.</h2><p className="panel-subtitle">The quality gate runs again before every PDF, DOCX, or text export.</p></div><span className={`tier-badge ${result.qualityGate.ready ? "badge-exact" : "badge-insufficient"}`}>{result.qualityGate.ready ? "Ready to export" : "Review required"}</span></header><div className="panel-body"><div className="quality-grid">{result.qualityGate.checks.map(check => <div className="quality-item" key={check.key}><span className={`quality-status status-${check.status}`} /><div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}</div><div className="export-footer"><div className="export-note"><LockKeyhole size={14} /><span>PDF and DOCX exports use the selected structured, single-column ATS template. The master resume remains separately preserved.</span></div>{preparedExport && <a className="prepared-download" href={preparedExport.url} download={preparedExport.fileName}><Download size={13} /> Download prepared {preparedExport.label}</a>}<div className="export-actions"><button className="secondary-button" onClick={exportText} aria-label="Prepare plain text resume download"><Download size={14} /> Prepare text</button><button className="secondary-button" onClick={exportPdf} disabled={!result.qualityGate.ready} aria-label="Run the quality gate and prepare a PDF resume download"><Download size={14} /> Prepare ATS PDF</button><button className="primary-button" onClick={exportDocx} disabled={!result.qualityGate.ready} aria-label="Run the quality gate and prepare a DOCX resume download"><Download size={14} /> Prepare ATS DOCX</button></div></div></div></section>
        </section>}
      </main>
    </div>
  );
}
