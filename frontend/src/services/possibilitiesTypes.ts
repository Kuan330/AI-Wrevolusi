export type PossibilitySkillState = "have" | "learning" | "shortlisted" | "missing";
export type PossibilitySkill = { skill_id: number; skill_slug: string; name: string; state: PossibilitySkillState };
export type PossibilityDirection = { occupation_code: string; title: string; area: string | null; description: string; coverage_pct: number | null; skills: PossibilitySkill[] };
export type PossibilitiesResponse = {
  contract_version: "1"; score_semantics: "direction_skill_coverage"; disclaimer: string;
  source: "live" | "demo"; status: "ready" | "needs_profile" | "unavailable";
  current_role: { occupation_code: string; title: string } | null;
  current_role_coverage_pct: number | null; skills: PossibilitySkill[]; directions: PossibilityDirection[];
  chosen_direction_code: string | null; chosen_direction_coverage_pct: number | null; shortlisted_skill_ids: number[];
};
