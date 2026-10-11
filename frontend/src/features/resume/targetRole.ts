import type { OccupationRequirements } from "../../services/possibilitiesTypes.ts";
import type { ResumeDraft } from "./types.ts";

export function validTargetRole(value: unknown): value is OccupationRequirements {
  if (!value || typeof value !== "object") return false;
  const role = value as OccupationRequirements;
  return typeof role.occupation_code === "string" && Boolean(role.occupation_code.trim()) && role.occupation_code.length <= 100 &&
    typeof role.title === "string" && Boolean(role.title.trim()) && role.title.length <= 300 &&
    Array.isArray(role.skills) && role.skills.length <= 60 && role.skills.every(skill => skill &&
      Number.isSafeInteger(skill.skill_id) && skill.skill_id > 0 && typeof skill.skill_slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.skill_slug) && skill.skill_slug.length <= 120 &&
      typeof skill.name === "string" && Boolean(skill.name.trim()) && skill.name.length <= 120) &&
    new Set(role.skills.map(skill => skill.skill_id)).size === role.skills.length;
}

export function targetRequirements(role: OccupationRequirements | null): string {
  if (!role?.skills.length) return "";
  return [role.title, "Required skills:", ...role.skills.map(skill => `- ${skill.name}`)].join("\n");
}

/** Only the pending target changes; applied resume/interview evidence stays intact. */
export function withTargetRole(draft: ResumeDraft, role: OccupationRequirements | null): ResumeDraft {
  const requirements = targetRequirements(role);
  if (JSON.stringify(draft.targetRole ?? null) === JSON.stringify(role) && draft.pendingJobRequirements === requirements &&
    (!draft.proposal || draft.proposal.jobRequirements === requirements)) return draft;
  return { ...draft,
    ...(draft.targetRole === undefined && draft.pendingJobRequirements ? { legacyPendingJobRequirements: draft.pendingJobRequirements } : {}),
    targetRole: role, pendingJobRequirements: requirements, proposal: null };
}
