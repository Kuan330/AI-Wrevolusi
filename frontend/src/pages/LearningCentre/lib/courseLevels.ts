/** Course difficulty levels used in the learning catalogue. */
export const COURSE_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "unknown",
] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_LEVEL_LABEL: Record<CourseLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  unknown: "Not stated",
};

/**
 * Soft-capsule badge tones (system palette).
 * beginner → green · intermediate → blue · advanced → brown · unknown → muted purple-gray
 */
export const COURSE_LEVEL_TONE: Record<
  CourseLevel,
  { className: string; bg: string; text: string; border: string }
> = {
  beginner: {
    className: "course-level-badge--beginner",
    bg: "#e6f5eb",
    text: "#2e7d46",
    border: "rgba(46, 125, 70, 0.35)",
  },
  intermediate: {
    className: "course-level-badge--intermediate",
    bg: "#eaf3fb",
    text: "#35617c",
    border: "rgba(79, 145, 186, 0.42)",
  },
  advanced: {
    className: "course-level-badge--advanced",
    bg: "#f8ecef",
    text: "#8f6258",
    border: "rgba(201, 149, 137, 0.45)",
  },
  unknown: {
    className: "course-level-badge--unknown",
    bg: "#f3f0f6",
    text: "#958ca1",
    border: "rgba(149, 140, 161, 0.4)",
  },
};

export function isCourseLevel(value: string): value is CourseLevel {
  return (COURSE_LEVELS as readonly string[]).includes(value);
}

export function courseLevelLabel(level: string): string {
  return isCourseLevel(level)
    ? COURSE_LEVEL_LABEL[level]
    : COURSE_LEVEL_LABEL.unknown;
}

export function courseLevelClassName(level: string): string {
  const key = isCourseLevel(level) ? level : "unknown";
  return `course-level-badge ${COURSE_LEVEL_TONE[key].className}`;
}
