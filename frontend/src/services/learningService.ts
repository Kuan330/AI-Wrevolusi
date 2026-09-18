import { api } from "./api.ts";

/** Skill input for brief/summary — only `skill_id` is used by the server. */
export type SkillShape = {
  skill_id: string;
};

export type CatalogueCourse = {
  course_id: string;
  title: string;
  provider: string;
  url: string;
  level: string;
  course_no: number;
  chapter_count: number;
};

/** One row of `GET /learning/catalogue`. */
export type CatalogueSkill = {
  skill_id: string;
  skill_name: string;
  importance_pct: number | null;
  total_chapters: number;
  courses: CatalogueCourse[];
};

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
    reason: "not_increase" | "unknown_scope" | "invalid_value" | string;
    stored_value?: number | null;
  }[];
};

export type CheckinResponse = {
  checked_on: string;
  created: boolean;
  streak_days: number;
};

export type CalendarDay = {
  day: string;
  checked_in: boolean;
  studied: boolean;
  chapters_touched: number;
};

export type CalendarResponse = {
  from_date: string;
  to_date: string;
  days: CalendarDay[];
  streak_days: number;
  total_checked_in: number;
};

export type SkillSummary = {
  skill_id: string;
  total_chapters: number;
  target_value: number;
  earned_value: number;
  progress: number;
  last_studied_on: string | null;
  studied_today: boolean;
  is_candidate: boolean;
};

export type SummaryResponse = {
  local_date: string;
  streak_days: number;
  checked_in_today: boolean;
  skills: SkillSummary[];
  selected_skill_count: number;
};

export type Recommendation = {
  skill_id: string;
  skill_name: string;
  reason: string;
  progress: number;
  importance_pct?: number | null;
};

export type DailyBriefResponse = {
  local_date: string;
  variant: "before_checkin" | "after_checkin";
  checked_in_today: boolean;
  streak_days: number;
  greeting: string;
  summary: string;
  recommendations: Recommendation[];
  closing: string;
  generated_by_model: boolean;
  generated_at: string;
  cached: boolean;
};

/** Verified Bot catalogue (public, no login required). */
export function getLearningCatalogue(signal?: AbortSignal) {
  return api.get<CatalogueSkill[]>("/learning/catalogue", signal);
}

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

/** Calendar range for check-in / studied lights. */
export function getLearningCalendar(
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  return api.get<CalendarResponse>(
    `/learning/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    signal,
  );
}

/** Per-skill progress overview. */
export function postLearningSummary(localDate: string, skills: SkillShape[]) {
  return api.post<SummaryResponse>("/learning/summary", {
    local_date: localDate,
    skills,
  });
}

/** Daily bot briefing — first generation can be slow. */
export function postLearningDailyBrief(
  localDate: string,
  localHour: number,
  displayName: string | null,
  skills: SkillShape[],
  signal?: AbortSignal,
) {
  return api.post<DailyBriefResponse>(
    "/learning/daily-brief",
    {
      local_date: localDate,
      local_hour: localHour,
      display_name: displayName,
      skills,
    },
    60_000,
    signal,
  );
}

/** Authoritative saved chapter values for the signed-in learner. */
export function getLearningProgress() {
  return api.get<{ chapters: LearningChapterProgress[] }>("/learning/progress");
}
