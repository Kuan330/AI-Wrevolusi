export type PossibilitySkillState = "have" | "learning" | "shortlisted" | "missing";
export type PossibilitySkill = { skill_id: number; skill_slug: string; name: string; state: PossibilitySkillState };
export type CareerSkill = { uri: string; label: string; relation: "essential" | "optional"; state: "current" | "developing" | "not_yet_evidenced" };
export type ReviewedCareerSkill = { uri: string; label: string; state: "current" | "developing" };
export type CareerSource = { name: "ESCO"; version: string; retrieved_at: string; occupation_uri: string; source_url: string; attribution: string };
export type PossibilityDirection = {
  occupation_code: string; occupation_uri: string; title: string; area: string | null;
  description: string; coverage_pct: number | null; skills: PossibilitySkill[];
  requirements: CareerSkill[]; source: CareerSource;
  current_skill_overlap: number; developing_skill_overlap: number; essential_not_yet_evidenced: number;
};
export type PossibilitiesResponse = {
  contract_version: "2"; score_semantics: "reviewed_source_skill_overlap"; disclaimer: string;
  source: "live" | "demo"; status: "ready" | "needs_profile" | "needs_skill_review" | "unavailable";
  current_role: { occupation_code: string; title: string } | null;
  current_role_coverage_pct: number | null; skills: PossibilitySkill[]; directions: PossibilityDirection[];
  chosen_direction_code: string | null; chosen_direction_uri: string | null; chosen_direction_coverage_pct: number | null; shortlisted_skill_ids: number[];
  reviewed_esco_skills: ReviewedCareerSkill[]; career_source_note: string | null;
};
