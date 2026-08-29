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
