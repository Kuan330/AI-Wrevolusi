export type FocusSkill = { id: string; en: string; ico: string; hint: string };
export type Course = {
  id: string;
  title: string;
  provider: string;
  level: string;
  language: string;
  format: string;
  selfPaced: boolean;
  durationMin: number | null;
  register: string;
  url: string;
  skills: string[];
  match: Record<string, string>;
  intro: string;
  outcomes: string[];
  prereq: string;
  chapters: { title: string; min: number | null }[] | null;
  advice: string;
};
export type CourseChoice = {
  chapters: number[];
  weekdays: number[];
  minutesPerDay: number;
  scheduleMode?: "later" | "routine";
  startDate?: string;
};
export type RecommendationBasis = {
  tasks: string;
  goals: string;
  have: string;
};
export type PendingCourse = {
  courseId: string;
  choice: CourseChoice;
  addedAt: string;
};
export type LibraryState = {
  version: 1;
  skillId: string;
  saved: string[];
  choices: Record<string, CourseChoice>;
  basis: Record<string, RecommendationBasis>;
  pending: PendingCourse[];
};
export type CourseFilters = {
  query: string;
  level: string;
  provider: string;
  format: string;
  language: string;
  registration: string;
};
