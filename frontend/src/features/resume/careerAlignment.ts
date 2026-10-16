import { TAILORING_VERSION, type AppliedCareerAlignment, type Generation, type ResumeDocument, type RoleAlignment } from "./types.ts";
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const strings = (value: unknown) => Array.isArray(value) && value.every(row => typeof row === "string");
export function validRoleAlignment(value: unknown): value is RoleAlignment {
  if (!object(value) || typeof value.occupation_code !== "string" || typeof value.title !== "string" || !strings(value.summary_fact_ids) || !strings(value.project_order) || !Array.isArray(value.requirements) || value.requirements.length > 60 || !Array.isArray(value.links) || value.links.length > 250) return false;
  const requirements = value.requirements;
  const tasks = value.task_references ?? [];
  if (!Array.isArray(tasks) || tasks.length > 100 || !tasks.every(task => object(task) && typeof task.id === "string" && typeof task.text === "string") || new Set(tasks.map(task => task.id)).size !== tasks.length) return false;
  return requirements.every(row => object(row) && Number.isSafeInteger(row.skill_id) && typeof row.name === "string") && value.links.every(row => object(row) && typeof row.skill_id === "string" && typeof row.name === "string" && ((row.task_id == null && requirements.some(requirement => requirement.skill_id === row.requirement_skill_id)) || (row.requirement_skill_id == null && tasks.some(task => task.id === row.task_id))) && ["standard_mapping", "ai_semantic"].includes(String(row.method)) && Array.isArray(row.origins) && row.origins.length <= 20 && row.origins.every(origin => object(origin) && ["reviewed_resume", "platform_confirmed", "learning_intention", "reviewed_learning"].includes(String(origin.kind)) && typeof origin.label === "string" && strings(origin.fact_ids)) && Array.isArray(row.examples) && row.examples.every(example => object(example) && typeof example.fact_id === "string" && typeof example.text === "string" && ["resume", "course_completion", "study", "course_practice", "workplace_practice"].includes(String(example.kind))) && Array.isArray(row.locations) && row.locations.every(location => object(location) && typeof location.section === "string" && Number.isSafeInteger(location.entry_index) && Number(location.entry_index) >= 0 && Number(location.entry_index) < 250));
}
export function validAppliedAlignment(value: unknown): value is AppliedCareerAlignment {
  return object(value) && validRoleAlignment(value.alignment) && strings(value.sections) && typeof value.contentFingerprint === "string" && typeof value.needsReview === "boolean";
}
export function appliedCareerAlignment(generation: Generation, document: ResumeDocument, sections: string[]): AppliedCareerAlignment | undefined {
  if (![TAILORING_VERSION, "career_evidence_v1"].includes(generation.tailoring_version ?? "") || !validRoleAlignment(generation.role_alignment)) return undefined;
  const alignment = structuredClone(generation.role_alignment);
  alignment.links = alignment.links.map(link => ({ ...link, locations: link.locations.filter(location => sections.includes(location.section)) })).filter(link => link.locations.length > 0);
  if (!sections.includes("Summary")) alignment.summary_fact_ids = [];
  if (!sections.includes("Projects")) alignment.project_order = [];
  return { alignment, sections, contentFingerprint: JSON.stringify(document.cv.sections), needsReview: false };
}
export function careerAlignmentNeedsReview(alignment: AppliedCareerAlignment, document: ResumeDocument | null) {
  return alignment.needsReview || alignment.contentFingerprint !== JSON.stringify(document?.cv.sections);
}
