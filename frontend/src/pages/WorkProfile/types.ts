export type ProfileTaskSource = "ilo" | "user";

export interface ProfileTask {
  id: string;
  wording: string;
  timeSpent: string;
  responsibility: string;
  source: ProfileTaskSource;
  iloTaskId?: string;
  originalWording?: string;
}

export interface TaskEditorValues {
  wording: string;
  timeSpent: string;
  responsibility: string;
}
