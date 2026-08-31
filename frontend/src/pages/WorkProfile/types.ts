export type ProfileTaskSource = "ilo" | "user";
export type ScoreSource = "official" | "estimated";
export type SkillConfidenceBand = "identified" | "possible";

export interface TaskSkillPrediction {
  skillId: string;
  wefSkillId: number;
  confidence: SkillConfidenceBand;
  evidence: string;
  reason: string;
  matchLayer: string;
}

export type ExposureBand =
  | "human_led"
  | "ai_assisted"
  | "partly_automated"
  | "automated"
  | "insufficient_data";

export interface ProfileTask {
  id: string;
  wording: string;
  timeSpent: string;
  responsibility: string;
  source: ProfileTaskSource;
  iloTaskId?: string;
  originalWording?: string;
  originalScore2025?: number | null;
  score2025?: number | null;
  scoreSource?: ScoreSource;
  potential25?: string | null;
  meanScore2025?: number | null;
  band?: ExposureBand | null;
  skillPredictions?: TaskSkillPrediction[];
  insufficientSkillContext?: boolean;
}

export interface TaskEditorValues {
  wording: string;
  timeSpent: string;
  responsibility: string;
}

export const isEditedIloTask = (task: ProfileTask) =>
  task.source === "ilo" && task.wording.trim() !== (task.originalWording ?? "").trim();

export const needsExposureEstimate = (task: ProfileTask) =>
  task.source === "user" || isEditedIloTask(task);

export const hasExposureScore = (task: ProfileTask) => typeof task.score2025 === "number";

