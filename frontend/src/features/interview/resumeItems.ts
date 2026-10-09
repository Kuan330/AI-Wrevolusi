import { prepareAssistantContext, restoreAssistantValue } from "../resume/assistant.ts";
import { entryText } from "../resume/document.ts";
import { entryLabel } from "../resume/review.ts";
import type { ResumeDocument } from "../resume/types.ts";
import type { InterviewItem, ItemKind } from "./types.ts";

const SECTION_KINDS: [RegExp, ItemKind][] = [
  [/skill|competenc|abilit/i, "skill"],
  [/project/i, "project"],
  [/experience|employment|work|career|intern|volunteer/i, "work"],
  [/summary|profile|about|objective/i, "summary"],
];
const MAX_ITEMS = 30, MAX_SKILLS = 8, MAX_REQUIREMENTS = 8;
export const sectionKind = (title: string): ItemKind | null => SECTION_KINDS.find(([pattern]) => pattern.test(title))?.[1] ?? null;

/** Work, project, skill and summary entries of the reviewed resume. Education and other chapters are not asked about. */
export function buildResumeItems(document: ResumeDocument): InterviewItem[] {
  const items: InterviewItem[] = [];
  let skills = 0;
  Object.entries(document.cv.sections ?? {}).forEach(([title, entries], section) => {
    const kind = sectionKind(title);
    if (!kind) return;
    entries.forEach((entry, index) => {
      const text = entryText(entry).trim().slice(0, 1500), label = entryLabel(entry);
      if (!text || !label || items.length >= MAX_ITEMS) return;
      if (kind === "skill" && ++skills > MAX_SKILLS) return;
      items.push({ id: `r${section}-${index}`, kind, label, text: kind === "skill" ? "" : text, ref: { section: title, index } });
    });
  });
  return items;
}

const bullet = /^\s*(?:[-•*·]|\d+[.)])\s*/;
/** The first line of pasted job requirements is the role title. */
export function roleTitleFromRequirements(requirements: string): string {
  const first = requirements.split(/\r?\n/).map(line => line.replace(bullet, "").trim()).find(Boolean) ?? "";
  return first && first.length <= 100 ? first : "Target role";
}
/** Each requirement line becomes a practice topic. Headings and the title line are skipped. */
export function buildRequirementItems(requirements: string): InterviewItem[] {
  const lines = requirements.split(/\r?\n/).filter(line => line.trim());
  const body = lines.slice(bullet.test(lines[0] ?? "") ? 0 : 1);
  return body.map(line => line.replace(bullet, "").trim()).filter(line => line.length >= 6 && !/:$/.test(line))
    .slice(0, MAX_REQUIREMENTS).map((label, index) => ({ id: `q${index}`, kind: "requirement" as const, label: label.slice(0, 160), text: "" }));
}

/** What the user sees, and the redacted copy AI receives. Both share item ids. */
export function prepareInterviewContext(document: ResumeDocument | null, requirements: string, extra = "") {
  const context = prepareAssistantContext(document ?? { cv: { sections: {} } }, [], "", extra);
  const display = [...(document ? buildResumeItems(document) : []), ...buildRequirementItems(requirements)];
  const sent = display.map(({ id, kind, label, text }) => ({ id, kind, label: context.redact(label), text: context.redact(text) }));
  return {
    display, sent, roleTitle: roleTitleFromRequirements(requirements), sentRoleTitle: context.redact(roleTitleFromRequirements(requirements)),
    restore: (value: string) => String(restoreAssistantValue(value, context.mapping)),
    redact: context.redact,
  };
}
