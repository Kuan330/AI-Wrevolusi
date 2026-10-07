import { resumeStore } from "../../infrastructure/storage/resumeStore.ts";
import { emptyDraft, type ResumeDraft, type ResumeSource } from "./types.ts";

const mapping = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const validDocument = (value: unknown) => mapping(value) && mapping(value.cv) &&
  (value.cv.sections === undefined || (mapping(value.cv.sections) && Object.values(value.cv.sections).every(entries => Array.isArray(entries) && entries.every(entry => typeof entry === "string" || mapping(entry)))));
const validGap = (value: unknown) => mapping(value) && typeof value.id === "string" && typeof value.label === "string" && strings(value.keywords) && strings(value.skill_slugs);
const validGeneration = (value: unknown) => mapping(value) && typeof value.jobRequirements === "string" &&
  Array.isArray(value.gaps) && value.gaps.every(validGap) && Array.isArray(value.sections) && value.sections.every(section =>
    mapping(section) && typeof section.title === "string" && Array.isArray(section.entries) && section.entries.every(entry =>
      mapping(entry) && typeof entry.text === "string" && strings(entry.skill_ids) && strings(entry.fact_ids)));
export function parseResumeRecord(raw: unknown, owner: string): ResumeDraft {
  if (raw === null || raw === undefined) return emptyDraft(owner);
  const record = raw as ResumeDraft;
  if (!mapping(raw) || record.version !== 1 || record.owner !== owner || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      typeof record.updatedAt !== "string" || typeof record.jobRequirements !== "string" || typeof record.pendingJobRequirements !== "string" || typeof record.yamlText !== "string" ||
      !Array.isArray(record.gaps) || !record.gaps.every(validGap) || !Array.isArray(record.recommendations) || !record.recommendations.every(course => mapping(course) && typeof course.course_id === "string" && typeof course.reason === "string" && strings(course.gap_ids)) ||
      (record.source !== null && (!record.source || !(record.source.file instanceof Blob) || typeof record.source.name !== "string" || typeof record.source.text !== "string" || typeof record.source.redactedText !== "string" || typeof record.source.reviewed !== "boolean" ||
        !mapping(record.source.contacts) || !["name", "email", "phone", "location", "website"].every(key => typeof record.source!.contacts[key as keyof typeof record.source.contacts] === "string") ||
        (record.source.skills !== undefined && !strings(record.source.skills)) || (record.source.skillsText !== undefined && typeof record.source.skillsText !== "string"))) ||
      (record.document !== null && !validDocument(record.document)) ||
      (record.previewDocument != null && !validDocument(record.previewDocument)) ||
      (record.proposal !== null && !validGeneration(record.proposal)) ||
      (record.previous !== null && (!mapping(record.previous) || !validDocument(record.previous.document) || typeof record.previous.yamlText !== "string" || typeof record.previous.jobRequirements !== "string"))) {
    throw new Error("Your local resume record could not be read. It has not been overwritten. Clear local resume data only if you want to start again.");
  }
  return record;
}
export const loadResumeDraft = async (owner: string) => parseResumeRecord(await resumeStore.read(owner), owner);
export async function saveResumeDraft(owner: string, draft: ResumeDraft, revision: number, isCurrent: () => boolean = () => true) {
  return resumeStore.update(owner, raw => {
    if (!isCurrent()) throw new Error("Your account changed. This resume was not saved into another account.");
    const current = parseResumeRecord(raw, owner);
    if (current.revision !== revision) throw new Error("Another tab changed this resume. Reload before editing; this tab has not overwritten it.");
    return { ...draft, owner, version: 1 as const, revision: revision + 1, updatedAt: new Date().toISOString() };
  });
}
export async function saveImportedResume(owner: string, source: ResumeSource, isCurrent: () => boolean) {
  return resumeStore.update(owner, raw => {
    if (!isCurrent()) throw new Error("Your account changed. Attach the resume again after signing in.");
    const current = parseResumeRecord(raw, owner);
    return { ...current, source, proposal: null, revision: current.revision + 1, updatedAt: new Date().toISOString() };
  });
}
export const clearResumeDraft = (owner: string) => resumeStore.clear(owner);
