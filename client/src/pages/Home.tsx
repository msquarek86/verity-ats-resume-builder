import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Check, ChevronRight, Download, FileText, FolderHeart, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Upload, WandSparkles } from "lucide-react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { useMemo, useState, type ChangeEvent } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

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

function words(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function formatTier(value: string) { return `badge-${value}`; }

async function extractDocumentText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt") return file.text();
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (extension === "pdf") {
    const data = new Uint8Array(await file.arrayBuffer());
    const task = pdfjsLib.getDocument({ data });
    const pdf = await task.promise;
    const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map(item => "str" in item ? item.str : "").join(" ");
    }));
    return pages.join("\n\n");
  }
  throw new Error("Choose a PDF, DOCX, or TXT file.");
}

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [message, setMessage] = useState("");
  const [masterId, setMasterId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState("intake");
  const [preparedExport, setPreparedExport] = useState<{ url: string; fileName: string; label: string } | null>(null);
  const analysis = trpc.resume.analyze.useMutation();
  const saveMaster = trpc.resume.saveMaster.useMutation();
  const saveVersion = trpc.resume.saveVersion.useMutation();

  const result = analysis.data;
  const stage = result ? "review" : activeView;
  const stats = useMemo(() => result ? {
    exact: result.matches.filter(match => match.tier === "exact").length,
    gaps: result.matches.filter(match => match.tier === "insufficient").length,
  } : null, [result]);

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
      const text = await extractDocumentText(file);
      if (!text.trim()) throw new Error("No readable text was found in that document.");
      if (target === "resume") setResumeText(text);
      else setJobDescription(text);
      setMessage(`${file.name} is ready for analysis.`);
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
      await saveVersion.mutateAsync({ masterResumeId: masterId, label: `${settings.targetRole || result.job.title} — Tailored`, targetRole: settings.targetRole || result.job.title, targetCompany: settings.targetCompany || result.job.company, jobDescription, settings: result.settings, analysis: result, qualityGate: result.qualityGate, resumeText: result.optimizedText });
      setMessage("Tailored version saved. Your master resume remains unchanged.");
    } catch {
      setMessage("Sign in to save this tailored version.");
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
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 52;
    const lines = pdf.splitTextToSize(latest.optimizedText, 510);
    let y = 58;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    lines.forEach((line: string) => {
      if (y > 730) { pdf.addPage(); y = 58; }
      pdf.text(line, margin, y);
      y += 15;
    });
    prepareExport(pdf.output("blob"), "tailored-resume.pdf", "PDF");
    } catch { setMessage("The quality gate could not run. Please try the export again."); }
  };
  const exportDocx = async () => {
    try {
      const latest = await recheckBeforeExport();
      if (!latest) return;
      const children = latest.optimizedText.split("\n").map(line => new Paragraph({ children: [new TextRun({ text: line || " ", bold: /^[A-Z][A-Z\s&]+$/.test(line) })], spacing: { after: line ? 90 : 25 } }));
      const document = new Document({ sections: [{ properties: {}, children }] });
      prepareExport(await Packer.toBlob(document), "tailored-resume.docx", "DOCX");
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
                  <div className="input-label"><span>Your master resume</span><span className="mini-label">SOURCE</span></div>
                  <textarea className="resume-textarea" value={resumeText} onChange={event => setResumeText(event.target.value)} placeholder="Paste the text of your existing resume here…" aria-label="Master resume text" />
                  <div className="input-footer"><label className="file-upload"><Upload size={13} /> Upload PDF, DOCX, or TXT<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => handleUpload(event, "resume")} /></label><span className="word-count">{words(resumeText)} words</span></div>
                </div>
                <div className="input-card">
                  <div className="input-label"><span>Target job description</span><span className="mini-label">CONTEXT</span></div>
                  <textarea className="resume-textarea" value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the full job description here…" aria-label="Job description text" />
                  <div className="input-footer"><label className="file-upload"><Upload size={13} /> Upload PDF, DOCX, or TXT<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => handleUpload(event, "job")} /></label><span className="word-count">{words(jobDescription)} words</span></div>
                </div>
              </div>
              <div className="action-row">
                <button className="sample-link" onClick={loadExample}>Load a guided example</button>
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
                <div className="field"><label className="field-label">Template</label><select className="select-input" value={settings.template} onChange={event => changeSetting("template", event.target.value as Settings["template"])}><option value="modern">Modern</option><option value="classic">Classic</option><option value="technical">Technical</option><option value="minimal">Minimal</option></select></div>
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

        {!result && !analysis.isPending && <section className="panel" style={{ marginTop: 24 }}><div className="empty-state"><div className="empty-orb"><Sparkles size={20} /></div><h3>Your evidence map will appear here.</h3><p>We will identify supported experience, distinguish adjacent skills from true matches, and surface gaps without overstating your qualifications.</p></div></section>}
        {analysis.isPending && <section className="panel results"><div className="loading-screen"><div className="loading-ring" /><h3>Building an evidence map…</h3><p>We are extracting source facts, reading the role, and checking every proposed claim against your resume.</p></div></section>}

        {result && <section className="results">
          <section className="panel score-panel" id="review">
            <div className="score-hero"><div><p className="panel-kicker">Estimated compatibility</p><div className="score-figure">{result.score.score}<span>/100</span></div><p className="score-label">{result.score.label}</p></div><p className="score-footnote">An internal optimization estimate—never a guarantee of any employer’s ATS outcome.</p></div>
            <div className="score-content"><h3>What the score actually means.</h3><p>{stats?.exact ?? 0} direct match{stats?.exact === 1 ? "" : "es"} and {stats?.gaps ?? 0} evidence gap{stats?.gaps === 1 ? "" : "s"} were found against the analyzed requirements.</p><div className="score-breakdown">{result.score.breakdown.map(item => <div className="score-row" key={item.key}><label>{item.label}</label><strong>{item.score}%</strong><div className="progress-bar"><span style={{ width: `${item.score}%` }} /></div></div>)}</div></div>
          </section>

          <div className="match-grid" id="intelligence">
            <section className="panel"><header className="panel-header"><div><p className="panel-kicker">02 / Match intelligence</p><h2 className="panel-title">Evidence, not equivalence.</h2><p className="panel-subtitle">Each target requirement is graded by what your original resume actually supports.</p></div></header><div className="panel-body"><div className="match-list">{result.matches.map(match => <div className="match-row" key={match.requirementId}><span className={`tier-dot tier-${match.tier}`} /><div><div className="match-name">{match.requirement}</div><div className="match-evidence">{match.evidence[0]?.quote || match.explanation}</div></div><span className={`tier-badge ${formatTier(match.tier)}`}>{readableTier[match.tier]}</span></div>)}</div><div className="legend"><span className="legend-item"><i className="tier-dot tier-exact" />Exact evidence</span><span className="legend-item"><i className="tier-dot tier-semantic" />Curated semantic</span><span className="legend-item"><i className="tier-dot tier-related" />Related, not equivalent</span><span className="legend-item"><i className="tier-dot tier-insufficient" />Insufficient evidence</span></div></div></section>
            <section className="panel"><header className="panel-header"><div><p className="panel-kicker">Smart suggestions</p><h2 className="panel-title">Next best actions.</h2></div></header><div className="panel-body"><div className="advice-section">{result.score.improvedBy.slice(0, 2).map(item => <div className="advice-item success" key={item}><h4>Evidence already present</h4><p>{item}</p></div>)}{result.score.nextSteps.slice(0, 3).map(item => <div className="advice-item" key={item}><h4>Confirm before adding</h4><p>{item}</p></div>)}{result.score.loweredBy.length === 0 && <div className="advice-item success"><h4>Strong coverage</h4><p>Your source resume supports the major requirements identified in this role.</p></div>}</div></div></section>
          </div>

          <section className="panel"><header className="panel-header"><div><p className="panel-kicker">03 / Before & after</p><h2 className="panel-title">A transparent rewrite.</h2><p className="panel-subtitle">The tailored version prioritizes evidence from your master resume. Every claim is reviewed before export.</p></div><button className="secondary-button" onClick={saveTailoredVersion} disabled={saveVersion.isPending || saveMaster.isPending}><FolderHeart size={14} /> {masterId ? "Save version" : "Save master first"}</button></header><div className="comparison-grid"><div className="document-side"><div className="document-label"><FileText size={12} /> Source resume</div><pre className="document-text">{resumeText}</pre></div><div className="document-side"><div className="document-label"><Sparkles size={12} /> Tailored resume</div><pre className="document-text optimized">{result.optimizedText}</pre></div></div></section>

          <section className="panel"><header className="panel-header"><div><p className="panel-kicker">Claim provenance</p><h2 className="panel-title">Truth Guard review.</h2><p className="panel-subtitle">Each proposed line points back to the evidence that permits it.</p></div><ShieldCheck size={19} color="#1f5d48" /></header><div className="panel-body"><div className="truth-review">{result.claims.map((claim, index) => { const issue = result.qualityGate.truthIssues.find(item => item.claim === claim.text); return <article className={`claim-card ${issue?.severity ?? ""}`} key={`${claim.section}-${index}`}><div className="claim-meta"><span>{claim.section}</span><span>{issue ? issue.severity : "Supported"}</span></div><blockquote>“{claim.text}”</blockquote><div>{claim.evidenceIds.length ? claim.evidenceIds.map(evidenceId => <span className="evidence-chip" key={evidenceId}>Source: {evidenceId}</span>) : <span className="evidence-chip">No cited source</span>}</div>{issue && <p className="claim-issue">{issue.message}</p>}</article>; })}</div></div></section>

          <section className="panel" id="export"><header className="panel-header"><div><p className="panel-kicker">04 / Final quality gate</p><h2 className="panel-title">Ready only when the evidence is.</h2><p className="panel-subtitle">The quality gate runs again before every PDF, DOCX, or text export.</p></div><span className={`tier-badge ${result.qualityGate.ready ? "badge-exact" : "badge-insufficient"}`}>{result.qualityGate.ready ? "Ready to export" : "Review required"}</span></header><div className="panel-body"><div className="quality-grid">{result.qualityGate.checks.map(check => <div className="quality-item" key={check.key}><span className={`quality-status status-${check.status}`} /><div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}</div><div className="export-footer"><div className="export-note"><LockKeyhole size={14} /><span>Exports preserve a conventional, text-based reading order. The master resume is maintained separately from every tailored version.</span></div>{preparedExport && <a className="prepared-download" href={preparedExport.url} download={preparedExport.fileName}><Download size={13} /> Download prepared {preparedExport.label}</a>}<div className="export-actions"><button className="secondary-button" onClick={exportText}><Download size={14} /> Text</button><button className="secondary-button" onClick={exportPdf} disabled={!result.qualityGate.ready}><Download size={14} /> PDF</button><button className="primary-button" onClick={exportDocx} disabled={!result.qualityGate.ready}><Download size={14} /> DOCX</button></div></div></div></section>
        </section>}
      </main>
    </div>
  );
}
