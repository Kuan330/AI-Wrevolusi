import type { LearningGoal } from "../learning-goals/learningGoals.ts";
import type { PlanCourse, PlanState } from "../learning-planning/planCourses.ts";
import { addDays, dateKey } from "../learning-planning/planModel.ts";

export const coursePercent = (course: PlanCourse) => course.chapters.length
  ? Math.round(course.chapters.reduce((sum, chapter) => sum + chapter.value, 0) / (course.chapters.length * 10) * 100) : 0;
export const courseStatus = (course: PlanCourse) => course.chapters.length > 0 && course.chapters.every(chapter => chapter.value === 10) ? "completed" : course.chapters.some(chapter => chapter.value > 0) ? "learning" : "planned";
export type LearningActivity = { id: string; date: string; label: string; detail: string; kind: "course" | "study" | "practice" | "checkin"; courseId?: string; goalId?: string };
export function learningActivities(plan: PlanState, goals: LearningGoal[]): LearningActivity[] {
  const course: LearningActivity[] = Object.entries(plan.records).flatMap(([date, day]) => {
    const records: LearningActivity[] = (day.entries ?? []).map((entry, index) => ({ id: `course:${date}:${entry.courseId}:${index}`, date, label: entry.chapterTitle, detail: `${entry.courseTitle} · ${entry.percent}% recorded`, kind: "course", courseId: entry.courseId }));
    if (day.checked) records.push({ id: `checkin:${date}`, date, label: "Learning check-in", detail: day.note || "You checked in to your learning plan.", kind: "checkin" });
    if (!records.length && (day.studied || day.minutes > 0 || day.note.trim())) records.push({ id: `study:${date}`, date, label: "Learning activity", detail: day.note || (day.minutes ? `${day.minutes} minutes recorded` : "Study recorded"), kind: "study" });
    return records;
  });
  const attempts: LearningActivity[] = goals.flatMap(goal => goal.attempts.map(attempt => ({ id: `attempt:${goal.id}:${attempt.id}`, date: attempt.date, label: attempt.description, detail: goal.wording, kind: attempt.type === "study" ? "study" : "practice", goalId: goal.id })));
  return [...course, ...attempts].sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function activityDays(activities: LearningActivity[], today = dateKey(new Date())) {
  const counts = new Map<string, number>();
  for (const item of activities) counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
  return Array.from({ length: 84 }, (_, index) => { const date = addDays(today, index - 83); return { date, count: counts.get(date) ?? 0 }; });
}
export function learningSummary(plan: PlanState, goals: LearningGoal[], resumeCourseId?: string) {
  const active = plan.courses.filter(course => courseStatus(course) !== "completed");
  const nextCourse = active.find(course => course.id === resumeCourseId) ?? active[0];
  const chapters = plan.courses.flatMap(course => course.chapters);
  return {
    nextCourse, nextChapter: nextCourse?.chapters.find(chapter => chapter.value < 10),
    totalChapters: chapters.length, completedChapters: chapters.filter(chapter => chapter.value === 10).length,
    completedCourses: plan.courses.filter(course => courseStatus(course) === "completed").length,
    percent: chapters.length ? Math.round(chapters.reduce((sum, chapter) => sum + chapter.value, 0) / (chapters.length * 10) * 100) : 0,
    activities: learningActivities(plan, goals),
  };
}
