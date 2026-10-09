import { sourceHeading } from "./sections.ts";
import type { ResumeSource } from "./types.ts";
export const SKILLS_PARSER_VERSION = 2;
const normal = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const bullet = (s: string) => s.replace(/^[•●▪*-]\s*/, "").trim();
const category = /^(?:sales\s*(?:&|and)\s*advisory|product knowledge|compliance|soft skills|technical skills|t\s*ools|technologies|skills)\s*[:：]\s*/i;
const responsibility = /^(?:achiev(?:e|ed|ing)|assist(?:ed|ing)?|conduct(?:ed|ing)?|exceed(?:ed|ing)?|generat(?:e|ed|ing)|guid(?:e|ed|ing)|handl(?:e|ed|ing)|maintain(?:ed|ing)?|manag(?:e|ed|ing)|reduc(?:e|ed|ing)|support(?:ed|ing)?|work(?:ed|ing)?)\b/i;
export function skillLabelIsSafe(name: string): boolean {
  return Boolean(name.trim()) && !sourceHeading(name) && !/@|\[REDACTED\]|\b\d+(?:[.,]\d+)*\s*(?:%|\+)|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b|\b(?:Berhad|Sdn\.? Bhd\.?|Inc\.|Ltd\.|Corporation)\b/i.test(name) && !responsibility.test(name.trim());
}
function skillLine(line: string): string[] {
  const raw = bullet(line);
  const isProduct = /^product knowledge\s*[:：]/i.test(raw);
  const value = raw.replace(category, "");
  // Shared qualifiers are deliberately not guessed or lost ("Life, medical, ... insurance").
  const items = isProduct || /,\s*(?:and|or)\s+/i.test(value) ? [value] : value.split(/[,;|•]/);
  return items.map(v => v.trim().replace(/^(?:and|or)\s+/i, "")).filter(skillLabelIsSafe);
}
/** Only an explicitly labelled Skills block; never mine work history for skills. */
export function explicitResumeSkills(text: string): string[] {
  const result: string[] = [];
  let active = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = sourceHeading(line);
    if (heading) { if (active) break; active = heading === "Skills"; continue; }
    if (active) result.push(...skillLine(line));
  }
  return [...new Map(result.map(name => [normal(name), name])).values()];
}
/** Legacy auto-extraction is rebuilt without changing the source or current CV. */
export function reviewedSourceSkills(source: Pick<ResumeSource, "redactedText" | "skills" | "skillsText" | "skillsOrigin" | "skillsParserVersion">) {
  const automatic = explicitResumeSkills(source.redactedText);
  const manual = source.skillsOrigin === "manual" || source.skillsText !== undefined;
  if (!manual) return { names: automatic, rejected: [] as string[], text: automatic.join("\n") };
  const text = source.skillsText ?? (source.skills ?? []).join("\n");
  // New editing uses one skill per line; old comma-separated drafts remain readable.
  const names = text.includes("\n") || source.skillsParserVersion === SKILLS_PARSER_VERSION
    ? text.split(/[\r\n;]+/).map(s => s.trim()).filter(Boolean)
    : text.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  let inSkills = false;
  const outside = new Set<string>();
  for (const line of source.redactedText.split(/\r?\n/)) {
    const heading = sourceHeading(line);
    if (heading) { inSkills = heading === "Skills"; continue; }
    if (!inSkills) for (const item of [line, ...line.split(/[,;|]/)]) outside.add(normal(bullet(item)));
  }
  const accepted = new Set(automatic.map(normal));
  const rejected = names.filter(name => !skillLabelIsSafe(name) || (outside.has(normal(name)) && !accepted.has(normal(name))));
  const blocked = new Set(rejected.map(normal));
  return { names: [...new Map(names.filter(name => !blocked.has(normal(name))).map(name => [normal(name), name])).values()], rejected, text };
}
