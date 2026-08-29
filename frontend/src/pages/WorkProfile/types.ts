export type ProfileTaskSource = "ilo" | "user";

export interface ProfileTask {
  id: string;
  wording: string;
  timeSpent: string;
  responsibility: string;
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
  responsibility: string;
}
