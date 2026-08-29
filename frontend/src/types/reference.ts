export interface ReferenceOccupation {
  occupation_code: string;
  level: string;
  parent_code: string | null;
  title: string;
  description: string | null;
}

export interface ReferenceTask {
  isco_08: string;
  task_id: string;
  task_text: string;
  score_2025: number | null;
  potential25: string | null;
  mean_score_2025: number | null;
}

export interface WefSkill {
  wef_skill_id: number;
  core_skill: string;
  wef_skill_group: string | null;
  future_trend_category: string | null;
  future_net_increase_2025_2030: number | null;
  genai_substitution_capacity_category: string | null;
}
