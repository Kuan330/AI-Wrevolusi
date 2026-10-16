import { entryText } from "./document.ts";
import { sourceHeading } from "./sections.ts";
import { explicitResumeSkills } from "./sourceSkills.ts";
import type { ResumeDocument, SkillCandidate } from "./types.ts";

const key = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

/** Compare actual content, including restored drafts and grouped skill entries. */
export function pendingResumeSkills(document: ResumeDocument | null, candidates: SkillCandidate[]): SkillCandidate[] {
  const entries = Object.entries(document?.cv.sections ?? {})
    .filter(([title]) => sourceHeading(title) === "Skills")
    .flatMap(([, rows]) => rows);
  const labels = entries.map(entryText);
  const grouped = entries.map(entry => typeof entry === "object" && typeof entry.details === "string" ? entry.details : entryText(entry));
  const included = new Set([...labels, ...explicitResumeSkills("Skills\n" + grouped.join("\n"))].map(key));
  return candidates.filter(skill => !included.has(key(skill.name)));
}
