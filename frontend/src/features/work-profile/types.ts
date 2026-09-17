export type ProfileTaskSource = "ilo" | "user";
export type TaskAssessmentContextLevel = "" | "low" | "medium" | "high";

export interface ProfileTask {
  id: string;
  wording: string;
  timeSpent: string;
  notes?: string;
  responsibility: string;
  routineProcessingLevel: TaskAssessmentContextLevel;
  informationUseLevel: TaskAssessmentContextLevel;
  humanInteractionLevel: TaskAssessmentContextLevel;
  judgementLevel: TaskAssessmentContextLevel;
  practice?: TaskPractice;
  source: ProfileTaskSource;
  iloTaskId?: string;
  originalWording?: string;
  score2025?: number | null;
  potential25?: string | null;
  meanScore2025?: number | null;
}

export interface TaskEditorValues {
  wording: string;
  timeSpent: string;
  notes: string;
}

export type TrialQuality = "met" | "partly" | "not_met";
export interface TaskBaseline {
  minutes: number;
  workload: string;
  taskWording: string;
}
export interface TaskTrial {
  id: string;
  createdAt: string;
  taskWording: string;
  workload: string;
  minutes: number;
  quality: TrialQuality;
  baselineMinutes: number | null;
  sameWorkload: boolean;
}
export interface TaskPractice {
  baseline?: TaskBaseline;
  trials: TaskTrial[];
}
