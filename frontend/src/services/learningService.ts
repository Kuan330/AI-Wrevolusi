import { api } from "./api";

export type LearningChapterProgress = {
  skill_id: string;
  course_id: string;
  chapter_index: number;
  value: number;
};

export type ProgressUpdateResponse = {
  accepted: number;
  updated: LearningChapterProgress[];
  rejected: {
    course_id: string;
    chapter_index: number;
    reason: string;
    stored_value?: number | null;
  }[];
};

export type CheckinResponse = {
  checked_on: string;
  created: boolean;
  streak_days: number;
};

/** Persist chapter values for one local day (0–10 scale, forward-only). */
export function postLearningProgress(
  localDate: string,
  chapters: LearningChapterProgress[],
) {
  return api.post<ProgressUpdateResponse>("/learning/progress", {
    local_date: localDate,
    chapters,
  });
}

/** Check in after progress exists for that day. */
export function postLearningCheckin(localDate: string) {
  return api.post<CheckinResponse>("/learning/checkin", {
    local_date: localDate,
  });
}
