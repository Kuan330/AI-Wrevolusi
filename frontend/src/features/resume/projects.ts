import { sourceSections } from "./sections.ts";
import { evidenceFromText } from "./redaction.ts";
import type { ResumeEvidence, SourceProject } from "./types.ts";
const bullet = /^[•●▪*-]\s+/;
const date = /^(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\d{4}(?:-\d{2})?)(?:\s*[–—-]\s*(?:(?:[A-Za-z]+\s+)?\d{4}(?:-\d{2})?|Present))?$/i;
function header(text: string): { name: string; date: string | null } | null {
  const parts = text.split(/\s+[|·–—]\s+|\s{2,}/);
  if (parts.length === 2 && date.test(parts[1]) && parts[0].length <= 300) return { name: parts[0], date: parts[1] };
  const end = text.match(/^(.*?)\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})$/i);
  return end && end[1].length <= 300 ? { name: end[1].replace(/\s*[|·–—]\s*$/, ""), date: end[2] } : null;
}
/** Conservative local extraction from the exact redacted, reviewed evidence. Never infer a project. */
export function sourceProjects(evidence: ResumeEvidence[]): SourceProject[] {
  const facts = new Map(evidence.map(f => [f.id, f]));
  const result = sourceSections(evidence).filter(section => section.title === "Projects").flatMap(section => parseProjectRows(section.fact_ids.map(id => facts.get(id)!)));
  return result.map((project, i) => ({ ...project, id: `project-${i + 1}` }));
}
function parseProjectRows(rows: ResumeEvidence[]): SourceProject[] {
  if (!rows.length) return [];
  const raw = (): SourceProject[] => [{ id: "project-1", mode: "verbatim", fact_ids: rows.map(f => f.id), highlight_fact_ids: [] }];
  const projects: SourceProject[] = [];
  let i = 0;
  while (i < rows.length) {
    const first = rows[i];
    if (bullet.test(first.text) || first.text.length > 400) return raw();
    let identity = header(first.text);
    const refs = [first.id];
    i++;
    if (!identity && i < rows.length && date.test(rows[i].text) && first.text.length <= 300) {
      identity = { name: first.text, date: rows[i].text }; refs.push(rows[i++].id);
    }
    // Names without a clear date/header or non-bullet prose are ambiguous: retain ALL raw lines.
    if (!identity?.name) return raw();
    const highlights: string[] = [];
    while (i < rows.length && bullet.test(rows[i].text)) { highlights.push(rows[i].id); refs.push(rows[i++].id); }
    if (!highlights.length || highlights.length > 18 || refs.length > 20) return raw();
    projects.push({ id: `project-${projects.length + 1}`, mode: "structured", name: identity.name, date: identity.date, fact_ids: refs, highlight_fact_ids: highlights });
  }
  return projects.length <= 80 ? projects : raw();
}
export function reviewedResumeInput(text: string) {
  const evidence = evidenceFromText(text);
  const projects = sourceProjects(evidence);
  const entries = projects.reduce((n, p) => n + (p.mode === "verbatim" ? p.fact_ids.length : 1), 0);
  if (entries > 80) throw new Error("The Projects section exceeds 80 paragraphs. Shorten the reviewed source before generating; no project text has been dropped.");
  return { evidence, projects, sections: sourceSections(evidence) };
}
