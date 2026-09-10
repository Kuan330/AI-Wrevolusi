import type { Course, CourseChoice } from "../types";
export const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function defaultChoice(course: Course): CourseChoice {
  return {
    chapters: course.chapters?.map((_, index) => index) ?? [],
    weekdays: [],
    minutesPerDay: 30,
    scheduleMode: "later",
  };
}
export function selectedMinutes(
  course: Course,
  choice: CourseChoice,
): number | null {
  if (!course.chapters?.length) return course.durationMin;
  const selected = course.chapters.filter((_, index) =>
    choice.chapters.includes(index),
  );
  if (!selected.length) return 0;
  if (selected.every((chapter) => chapter.min !== null))
    return selected.reduce((sum, chapter) => sum + (chapter.min ?? 0), 0);
  return selected.length === course.chapters.length ? course.durationMin : null;
}
export function durationLabel(minutes: number | null): string {
  if (minutes === null) return "Duration not stated";
  const hours = Math.floor(minutes / 60),
    remainder = minutes % 60;
  return (
    [hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""]
      .filter(Boolean)
      .join(" ") || "0m"
  );
}
export function estimateLabel(course: Course, choice: CourseChoice): string {
  if (choice.scheduleMode === "later") return "Schedule later in My Plan.";
  if (!choice.weekdays.length)
    return "Choose study days to estimate your pace.";
  const minutes = selectedMinutes(course, choice);
  if (minutes === null)
    return "Selected content duration is unknown; weeks cannot be estimated.";
  if (minutes === 0) return "Choose at least one chapter.";
  return `About ${Math.ceil(minutes / (choice.weekdays.length * choice.minutesPerDay))} weeks at ${choice.weekdays.length} days/week × ${choice.minutesPerDay} min/day. Estimate only.`;
}
export function validateChoice(
  course: Course,
  choice: CourseChoice,
): string | null {
  if (course.chapters?.length && !choice.chapters.length)
    return "Select at least one chapter before adding to your plan.";
  if (choice.scheduleMode !== "later" && !choice.weekdays.length)
    return "Choose at least one study day before adding to your plan.";
  if (
    choice.scheduleMode === "routine" &&
    (!choice.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(choice.startDate))
  )
    return "Choose a start date for your weekly routine.";
  return null;
}
