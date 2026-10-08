import { controlFields, isMapping } from "./editorModel.ts";
import type { ResumeDocument, SkillCandidate } from "./types.ts";
export type AssistantMessage = { role: "user" | "assistant"; content: string };
export type AssistantProposal = {
  message: string;
  sections: { section_index: number; entries: { entry: string | Record<string, unknown>; source_ids: string[] }[] }[];
  design: { path: string[]; value: string | number | boolean | null }[];
};
const ENTRY_FIELDS = new Set("bullet text label details company position institution area degree date start_date end_date location summary highlights name title authors journal doi url number reversed_number".split(" "));
const PRIVATE_FIELDS = ["name", "email", "phone", "website", "location", "social_networks", "custom_connections"];
const EMAIL = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+\d[\d ().-]{6,}\d|\b\d{9,15}\b|\b(?:\(\d{2,4}\)|\d{2,4})[ .-]\d{3,4}[ .-]\d{3,4}\b)/g;
const strings = (value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings) : isMapping(value) ? Object.values(value).flatMap(strings) : [];
const readPath = (root: unknown, path: string[]): unknown => path.reduce<unknown>((value, key) => isMapping(value) ? value[key] : undefined, root);
function writePath(root: Record<string, unknown>, path: string[], value: unknown) {
  let target = root;
  for (const key of path.slice(0, -1)) { target[key] = isMapping(target[key]) ? { ...target[key] } : {}; target = target[key] as Record<string, unknown>; }
  target[path.at(-1)!] = value;
}
export function assistantReviewKey(document: ResumeDocument, skills: SkillCandidate[], extra: string): string { return JSON.stringify([document, skills, extra]); }
export function prepareAssistantContext(document: ResumeDocument, skills: SkillCandidate[], instruction: string, extra = "") {
  const mapping: Record<string, string> = {};
  const privateTerms = [...PRIVATE_FIELDS.flatMap(key => strings(document.cv[key])), ...extra.split(/\n/)].map(value => value.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  const token = (value: string): string => {
    const found = Object.entries(mapping).find(([, original]) => original === value)?.[0];
    if (found) return found;
    const key = `[PRIVATE_${Object.keys(mapping).length + 1}]`; mapping[key] = value; return key;
  };
  const redact = (text: string) => {
    let value = text;
    for (const term of privateTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const boundary = /^[\p{L}\p{N}]/u.test(term) && /[\p{L}\p{N}]$/u.test(term);
      value = value.replace(new RegExp(boundary ? `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])` : escaped, "giu"), match => token(match));
    }
    return value.replace(EMAIL, token).replace(PHONE, token);
  };
  const walk = (value: unknown): unknown => typeof value === "string" ? redact(value) : Array.isArray(value) ? value.map(walk) : isMapping(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), walk(item)])) : value;
  const sections = Object.fromEntries(Object.entries(document.cv.sections ?? {}).map(([title, entries]) => [title, entries.map(entry => isMapping(entry) ? Object.fromEntries(Object.entries(entry).filter(([key]) => ENTRY_FIELDS.has(key))) : entry)]));
  const design: Record<string, unknown> = {};
  if (document.design?.theme !== undefined) design.theme = document.design.theme;
  for (const field of controlFields(document, "design")) {
    const value = readPath(document.design, field.path);
    if (value !== undefined) writePath(design, field.path, value);
  }
  const redactedDocument = walk({ cv: { sections }, design }) as ResumeDocument;
  const redactedSkills = skills.map((skill, index) => ({ id: `candidate-${index}`, name: redact(skill.name) }));
  return { document: redactedDocument, skills: redactedSkills, instruction: redact(instruction), mapping, redact };
}
export function restoreAssistantValue(value: unknown, mapping: Record<string, string>): unknown {
  if (typeof value === "string") return value.replace(/\[PRIVATE_\d+\]/g, key => { if (!(key in mapping)) throw new Error("The assistant returned an unknown private-field reference."); return mapping[key]; });
  if (Array.isArray(value)) return value.map(item => restoreAssistantValue(item, mapping));
  if (isMapping(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreAssistantValue(item, mapping)]));
  return value;
}
export function applyAssistantProposal(document: ResumeDocument, proposal: AssistantProposal, selected: string[], mapping: Record<string, string>): ResumeDocument {
  const result = structuredClone(document), titles = Object.keys(document.cv.sections ?? {}), allowed = new Set(controlFields(document, "design").map(field => field.path.join(".")));
  allowed.add("theme");
  for (const change of proposal.sections) {
    if (!selected.includes(`section-${change.section_index}`)) continue;
    const title = titles[change.section_index];
    if (title === undefined || !Array.isArray(change.entries)) throw new Error("The proposed section no longer exists.");
    const old = document.cv.sections![title];
    result.cv.sections![title] = change.entries.map(candidate => {
      const restored = restoreAssistantValue(candidate.entry, mapping);
      const ref = candidate.source_ids.find(id => id.startsWith(`section-${change.section_index}-entry-`));
      const original = ref ? old[Number(ref.split("-").at(-1))] : undefined;
      return isMapping(restored) ? { ...(isMapping(original) ? original : {}), ...restored } : String(restored);
    });
  }
  for (const [index, change] of proposal.design.entries()) {
    if (!selected.includes(`design-${index}`)) continue;
    if (!allowed.has(change.path.join("."))) throw new Error("The assistant returned an unsupported design field.");
    if (!result.design) result.design = {};
    writePath(result.design, change.path, change.value);
  }
  return result;
}
