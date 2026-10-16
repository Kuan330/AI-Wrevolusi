import type { Course } from "../learning-planning/types.ts";
import type { LearningChapterProgress } from "../../services/learningService.ts";
import { completedResumeCourse } from "./learningRecords.ts";
import { mergeResumeSkills, type ResumeSkillInput } from "./skills.ts";
import type { CourseSkillReview, CourseSkillSource } from "./types.ts";
export type ResumeLearningCourse = { course: Course; status: "completed" | "in_progress" | "planned" | "unavailable" };
export function resumeLearningCourses(directory: Map<string, Course>, selected: string[], progress: LearningChapterProgress[] | null): ResumeLearningCourse[] {
  const ids = [...new Set([...selected, ...(progress ?? []).map(row => row.course_id)])];
  return ids.flatMap(id => {
    const course = directory.get(id); if (!course) return [];
    const status = progress === null ? "unavailable" : completedResumeCourse(course, progress) ? "completed" : progress.some(row => row.course_id === id && row.value > 0) ? "in_progress" : "planned";
    return [{ course, status }];
  });
}
export function reviewedCourseSkills(reviews: CourseSkillReview[], courses: ResumeLearningCourse[]) {
  const inputs: ResumeSkillInput[] = [], sources: CourseSkillSource[] = [];
  for (const review of reviews) {
    if (!review.reviewed || !review.skills.some(skill => skill.selected)) continue;
    const row = courses.find(row => row.course.id === review.course_id);
    if (!row || !row.course.sourceFingerprint || row.course.sourceFingerprint !== review.source_fingerprint) throw new Error("A confirmed course skill source changed. Refresh the catalogue and review the learning skills again.");
    for (const choice of review.skills.filter(skill => skill.selected)) {
      if (!choice.name.trim() || choice.name.length > 160 || !review.outcomes.includes(choice.quote) || !(row.course.teachingObjectives ?? row.course.outcomes.join("; ")).includes(choice.quote)) throw new Error("A course skill needs its original teaching-objective reference. Review learning skills again.");
      const skill = mergeResumeSkills([[{ id: choice.name, name: choice.name }]])[0];
      inputs.push({ skill, origin: { kind: "learning_intention", label: review.title + " · " + review.course_id + " · " + (row.status === "completed" ? "self-recorded completed course; competence not assessed" : row.status === "in_progress" ? "in progress" : row.status === "unavailable" ? "progress unavailable" : "planned learning"), fact_ids: [] } });
      sources.push({ skill_id: skill.id, course_id: review.course_id, source_fingerprint: review.source_fingerprint, quote: choice.quote });
    }
  }
  if (sources.length > 250) throw new Error("Course skill sources exceed the supported limit. Reduce your selections; no sources have been truncated.");
  return { inputs, sources };
}
export function validCourseSkillReviews(value: unknown): value is CourseSkillReview[] {
  if (!Array.isArray(value) || value.length > 250) return false;
  return new Set(value.map(row => row?.course_id)).size === value.length && value.every(row => row && typeof row.course_id === "string" && typeof row.title === "string" && typeof row.source_fingerprint === "string" && typeof row.outcomes === "string" && (row.reviewed === undefined || typeof row.reviewed === "boolean") && Array.isArray(row.notices) && row.notices.every((notice: unknown) => ["no_teaching_objectives", "invalid_suggestions", "no_skill_suggestions"].includes(String(notice))) && Array.isArray(row.skills) && row.skills.length <= 20 && row.skills.every((skill: Record<string, unknown>) => skill && typeof skill.name === "string" && Boolean(skill.name.trim()) && skill.name.length <= 160 && typeof skill.quote === "string" && skill.quote.trim().length >= 8 && skill.quote.length <= 2000 && (skill.selected === undefined || typeof skill.selected === "boolean")));
}
