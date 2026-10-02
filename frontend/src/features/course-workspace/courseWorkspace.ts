import type { PlanCourse } from "../learning-planning/planCourses";

export type CourseStatus = "not-started" | "in-progress" | "completed";
export function courseProgress(course: PlanCourse) {
  const total = course.chapters.length;
  const completed = course.chapters.filter(chapter => chapter.value === 10).length;
  const percent = total ? Math.round(course.chapters.reduce((sum, chapter) => sum + chapter.value, 0) / (total * 10) * 100) : 0;
  const status: CourseStatus = total > 0 && completed === total ? "completed" : course.chapters.some(chapter => chapter.value > 0) ? "in-progress" : "not-started";
  return { total, completed, percent, status, nextChapter: Math.max(0, course.chapters.findIndex(chapter => chapter.value < 10)) };
}
export function filterSavedCourses(courses: PlanCourse[], query: string, status: string) {
  const term = query.trim().toLowerCase();
  return courses.filter(course => (!status || courseProgress(course).status === status) && `${course.title} ${course.provider}`.toLowerCase().includes(term));
}
export function selectedChapter(course: PlanCourse, raw: string | null) {
  if (raw !== null && /^\d+$/.test(raw)) {
    const index = Number(raw);
    if (index < course.chapters.length) return index;
  }
  return courseProgress(course).nextChapter;
}
/** Catalogue URLs are external; never render script/data URLs from metadata. */
export function safeProviderUrl(raw?: string) {
  if (!raw) return null;
  try { const url = new URL(raw); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
export const statusLabel = (status: CourseStatus) => ({ "not-started": "Not started", "in-progress": "In progress", completed: "Completed" })[status];
