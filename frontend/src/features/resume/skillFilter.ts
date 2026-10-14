import { SKILL_FILTER_VERSION, type Generation, type ResumeDraft } from "./types.ts";
export function appliedSkillFilter(generation: Generation, fingerprint: string | undefined) {
  return { skillFilterVersion: generation.skill_filter_version === SKILL_FILTER_VERSION ? SKILL_FILTER_VERSION : undefined,
    skillFilterInputFingerprint: generation.skill_filter_version === SKILL_FILTER_VERSION ? fingerprint : undefined };
}
/** Manual/assistant edits invalidate the saved skill-source snapshot. */
export function invalidateEditedSkills(before: ResumeDraft, after: ResumeDraft): ResumeDraft {
  const beforeSections = before.document?.cv.sections, afterSections = after.document?.cv.sections;
  if (after.careerAlignment && !after.careerAlignment.needsReview && beforeSections !== afterSections && JSON.stringify(beforeSections) !== JSON.stringify(afterSections)) after = { ...after, careerAlignment: { ...after.careerAlignment, needsReview: true } };
  return beforeSections?.Skills === afterSections?.Skills || JSON.stringify(beforeSections?.Skills) === JSON.stringify(afterSections?.Skills)
    ? after : { ...after, skillFilterVersion: undefined, skillFilterInputFingerprint: undefined };
}
