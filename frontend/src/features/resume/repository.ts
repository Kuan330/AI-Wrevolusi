import { validTargetRole } from "./targetRole.ts";
import { resumeStore } from "../../infrastructure/storage/resumeStore.ts";
import { emptyDraft, type ResumeDraft, type ResumeSource } from "./types.ts";

const mapping = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const validDocument = (value: unknown) => mapping(value) && mapping(value.cv) &&
  (value.cv.sections == null || (mapping(value.cv.sections) && Object.values(value.cv.sections).every(entries => Array.isArray(entries) && entries.every(entry => typeof entry === "string" || mapping(entry)))));
const validGap = (value: unknown) => mapping(value) && typeof value.id === "string" && typeof value.label === "string" && strings(value.keywords) && strings(value.skill_slugs);
const validProject = (value: unknown) => mapping(value) && typeof value.name === "string" && (value.date == null || typeof value.date === "string") && strings(value.highlights);
const validSourceProject = (value: unknown) => mapping(value) && typeof value.id === "string" && ["structured", "verbatim"].includes(String(value.mode)) && strings(value.fact_ids) && strings(value.highlight_fact_ids) && (value.name == null || typeof value.name === "string") && (value.date == null || typeof value.date === "string");
const validOutcome = (value: unknown) => value == null || value === "tailored" || value === "source_preserved";
const validFilterVersion = (value: unknown) => value === undefined || value === null || value === "role_relevance_v1";
const validFilter = (value: { skillFilterVersion?: unknown; skillFilterInputFingerprint?: unknown }) => validFilterVersion(value.skillFilterVersion) && (value.skillFilterInputFingerprint === undefined || typeof value.skillFilterInputFingerprint === "string");
const validGeneration = (value: unknown) => mapping(value) && validFilterVersion(value.skill_filter_version) && validOutcome(value.outcome) && (value.notices === undefined || strings(value.notices)) && typeof value.jobRequirements === "string" && (value.inputFingerprint === undefined || typeof value.inputFingerprint === "string") &&
  Array.isArray(value.gaps) && value.gaps.every(validGap) && Array.isArray(value.sections) && value.sections.every(section =>
    mapping(section) && typeof section.title === "string" && Array.isArray(section.entries) && section.entries.every(entry =>
      mapping(entry) && typeof entry.text === "string" && strings(entry.skill_ids) && strings(entry.fact_ids) && (entry.project_id == null || typeof entry.project_id === "string") && (entry.project == null || validProject(entry.project)) && (entry.verbatim === undefined || typeof entry.verbatim === "boolean")));
const validSuggestion = (value: unknown) => mapping(value) && ["id", "sessionId", "createdAt", "section", "entryLabel", "text", "question"].every(key => typeof value[key] === "string") && Number.isSafeInteger(value.entryIndex) && Number(value.entryIndex) >= 0;
export function parseResumeRecord(raw: unknown, owner: string): ResumeDraft {
  if (raw === null || raw === undefined) return emptyDraft(owner);
  const record = raw as ResumeDraft;
  if (!validFilter(record ?? {}) || !validOutcome(record?.generationOutcome) || (record?.generationNotices !== undefined && !strings(record.generationNotices)) || (record?.generationInputFingerprint !== undefined && typeof record.generationInputFingerprint !== "string") || (record?.legacyPendingJobRequirements !== undefined && typeof record.legacyPendingJobRequirements !== "string") || (record?.targetRole != null && !validTargetRole(record.targetRole)) || !mapping(raw) || record.version !== 1 || record.owner !== owner || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      typeof record.updatedAt !== "string" || typeof record.jobRequirements !== "string" || typeof record.pendingJobRequirements !== "string" || typeof record.yamlText !== "string" ||
      !Array.isArray(record.gaps) || !record.gaps.every(validGap) || !Array.isArray(record.recommendations) || !record.recommendations.every(course => mapping(course) && typeof course.course_id === "string" && typeof course.reason === "string" && strings(course.gap_ids)) ||
      (record.source !== null && (!record.source || !(record.source.file instanceof Blob) || typeof record.source.name !== "string" || typeof record.source.text !== "string" || typeof record.source.redactedText !== "string" || typeof record.source.reviewed !== "boolean" ||
        !mapping(record.source.contacts) || !["name", "email", "phone", "location", "website"].every(key => typeof record.source!.contacts[key as keyof typeof record.source.contacts] === "string") ||
        (record.source.projects !== undefined && !(Array.isArray(record.source.projects) && record.source.projects.every(validSourceProject))) || (record.source.skillsParserVersion !== undefined && !Number.isSafeInteger(record.source.skillsParserVersion)) || (record.source.skillsOrigin !== undefined && !["extracted", "manual"].includes(record.source.skillsOrigin)) || (record.source.skills !== undefined && !strings(record.source.skills)) || (record.source.skillsText !== undefined && typeof record.source.skillsText !== "string"))) ||
      (record.reviewed != null && !(mapping(record.reviewed) && typeof record.reviewed.at === "string" && typeof record.reviewed.fingerprint === "string")) ||
      (record.interviewSuggestions != null && !(Array.isArray(record.interviewSuggestions) && record.interviewSuggestions.every(validSuggestion))) ||
      (record.document !== null && !validDocument(record.document)) ||
      (record.previewDocument != null && !validDocument(record.previewDocument)) ||
      (record.proposal !== null && !validGeneration(record.proposal)) ||
      (record.previous !== null && (!mapping(record.previous) || !validFilter(record.previous) || !validOutcome(record.previous.generationOutcome) || (record.previous.generationNotices !== undefined && !strings(record.previous.generationNotices)) || (record.previous.generationInputFingerprint !== undefined && typeof record.previous.generationInputFingerprint !== "string") || !validDocument(record.previous.document) || typeof record.previous.yamlText !== "string" || typeof record.previous.jobRequirements !== "string"))) {
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
