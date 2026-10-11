import type { ResumeEvidence, SourceSection } from "./types.ts";
const headings: [RegExp, string][] = [
  [/^(?:(?:technical|professional|core|key|soft|personal|specialist)\s+)?skills?$/i, "Skills"],
  [/^(?:(?:professional|work|employment|relevant|career)\s+)?experience$|^(?:employment|work history|employment history)$/i, "Experience"],
  [/^(?:(?:academic|personal|selected|professional)\s+)?projects?$/i, "Projects"],
  [/^education(?:\s+(?:and|&)\s+qualifications)?$|^academic background$/i, "Education"],
  [/^(?:(?:professional|career|personal)\s+)?summary$|^(?:profile|objective|about me)$/i, "Summary"],
];
const other = /^(?:(?:licenses?|licences?)\s*(?:&|and)\s*)?certifications?$|^certificates?$|^licenses?$|^licences?$|^awards?$|^achievements?$|^references?$|^interests?$|^languages?$|^volunteering$|^additional information$|^disclaimer$|^publications?$|^professional affiliations$|^volunteer experience$|^activities$|^hobbies$/i;
export function sourceHeading(line: string): string | null {
  const clean = line.trim().replace(/[:：]\s*$/, "").replace(/\s+/g, " ");
  for (const [pattern, title] of headings) if (pattern.test(clean)) return title;
  if (other.test(clean)) return clean;
  return null;
}
/** Section ownership comes only from reviewed line boundaries, never AI. */
export function sourceSections(evidence: ResumeEvidence[]): SourceSection[] {
  const sections: SourceSection[] = [];
  let current: SourceSection | null = null;
  for (const fact of evidence) {
    const title = sourceHeading(fact.text);
    if (title) {
      current = { title, heading_fact_id: fact.id, fact_ids: [], polishable_fact_ids: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: "Additional information", heading_fact_id: null, fact_ids: [], polishable_fact_ids: [] };
      sections.push(current);
    }
    current.fact_ids.push(fact.id);
    if ((current.title === "Experience" && /^[•●▪*-]\s*\S/.test(fact.text)) || current.title === "Summary") current.polishable_fact_ids.push(fact.id);
  }
  if (sections.length > 30 || sections.some(s => s.fact_ids.length > 80 && s.title !== "Skills" && s.title !== "Projects")) throw new Error("The reviewed resume exceeds the section limit. Shorten it before generating; no text has been dropped.");
  return sections;
}
