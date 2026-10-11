import { SKILL_FILTER_VERSION, type Generation, type ResumeDraft } from "./types.ts";
export function appliedSkillFilter(generation: Generation, fingerprint: string | undefined) {
  return { skillFilterVersion: generation.skill_filter_version === SKILL_FILTER_VERSION ? SKILL_FILTER_VERSION : undefined,
    skillFilterInputFingerprint: generation.skill_filter_version === SKILL_FILTER_VERSION ? fingerprint : undefined };
}
/** Manual/assistant edits remain possible, but must not claim the old filter proof. */
export function invalidateEditedSkills(before: ResumeDraft, after: ResumeDraft): ResumeDraft {
  return JSON.stringify(before.document?.cv.sections?.Skills) === JSON.stringify(after.document?.cv.sections?.Skills)
    ? after : { ...after, skillFilterVersion: undefined, skillFilterInputFingerprint: undefined };
}
