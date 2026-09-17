import { accountStorage, hasAccountWorkspace, currentWorkspaceSession, readGuestLegacyItem } from "../../services/accountStorage.ts";
import { loadCourseDirectory } from "./courseDirectory.ts";
import { readLibrary } from "./libraryStorage.ts";
import type { Course as CatalogueCourse } from "@/features/learning-planning/types";

export type PlanChapter = { title: string; value: number };
export type PlanCourse = {
  id: string;
  title: string;
  provider: string;
  /** Catalogue skill slug used when syncing progress to `/learning/progress`. */
  skillId?: string;
  chapters: PlanChapter[];
};
/** One chapter progress bump saved on a calendar day. */
export type PlanDayChapterEntry = {
  courseId: string;
  courseTitle: string;
  chapterTitle: string;
  /** 0–100 */
  percent: number;
};
export type PlanRecordDay = {
  minutes: number;
  note: string;
  studied: boolean;
  checked: boolean;
  /** Chapter progress recorded on this day (view-only on the calendar). */
  entries?: PlanDayChapterEntry[];
};
export type PlanState = {
  version: 1;
  courses: PlanCourse[];
  records: Record<string, PlanRecordDay>;
};

const KEY = "aiwrevolusi.plan.courses.v1";
const LEGACY_KEY = "aiwrevolusi.plan.learningPreview.v1";

const emptyState = (): PlanState => ({
  version: 1,
  courses: [],
  records: {},
});

function isChapter(value: unknown): value is PlanChapter {
  if (!value || typeof value !== "object") return false;
  const chapter = value as PlanChapter;
  return (
    typeof chapter.title === "string" &&
    Number.isInteger(chapter.value) &&
    chapter.value >= 0 &&
    chapter.value <= 10
  );
}

function isCourse(value: unknown): value is PlanCourse {
  if (!value || typeof value !== "object") return false;
  const course = value as PlanCourse;
  return (
    typeof course.id === "string" &&
    typeof course.title === "string" &&
    typeof course.provider === "string" &&
    (course.skillId === undefined || typeof course.skillId === "string") &&
    Array.isArray(course.chapters) &&
    course.chapters.every(isChapter)
  );
}

function isDayEntry(value: unknown): value is PlanDayChapterEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as PlanDayChapterEntry;
  return (
    typeof entry.courseId === "string" &&
    typeof entry.courseTitle === "string" &&
    typeof entry.chapterTitle === "string" &&
    Number.isFinite(entry.percent) &&
    entry.percent >= 0 &&
    entry.percent <= 100
  );
}

function isRecord(value: unknown): value is PlanRecordDay {
  if (!value || typeof value !== "object") return false;
  const record = value as PlanRecordDay;
  const entriesOk =
    record.entries === undefined ||
    (Array.isArray(record.entries) && record.entries.every(isDayEntry));
  return (
    Number.isFinite(record.minutes) &&
    typeof record.note === "string" &&
    typeof record.studied === "boolean" &&
    typeof record.checked === "boolean" &&
    entriesOk
  );
}

function parseState(raw: string | null): PlanState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PlanState;
    if (
      value?.version !== 1 ||
      !Array.isArray(value.courses) ||
      !value.courses.every(isCourse) ||
      !value.records ||
      typeof value.records !== "object" ||
      !Object.values(value.records).every(isRecord)
    ) {
      return null;
    }
    // Drop old demo seeds; planning list only holds committed learning courses.
    return {
      ...value,
      courses: value.courses.filter((course) => !course.id.startsWith("demo-")),
    };
  } catch {
    return null;
  }
}

export function readPlanState(): PlanState {
  const raw = accountStorage.getItem(KEY);
  const current = parseState(raw);
  if (current) return current;
  if (raw !== null) throw new Error("Saved plan could not be read. Your stored data has not been overwritten.");

  // Browser legacy data belongs to the guest. Signing in must never import it
  // implicitly into an empty account workspace.
  if (hasAccountWorkspace()) return emptyState();

  const legacy = parseState(readGuestLegacyItem(LEGACY_KEY));
  if (legacy) {
    savePlanState(legacy);
    return legacy;
  }
  return emptyState();
}

export function savePlanState(state: PlanState) {
  accountStorage.setItem(KEY, JSON.stringify(state));

}

export function catalogueToPlanCourse(
  course: CatalogueCourse,
  existing?: PlanCourse,
): PlanCourse {
  const titles =
    course.chapters?.length && course.chapters.length > 0
      ? course.chapters.map((chapter) => chapter.title)
      : ["Full course"];

  return {
    id: course.id,
    title: course.title,
    provider: course.provider,
    skillId: course.skills[0] || existing?.skillId,
    chapters: titles.map((title, index) => {
      const matched =
        existing?.chapters.find((chapter) => chapter.title === title) ??
        existing?.chapters[index];
      return { title, value: matched?.value ?? 0 };
    }),
  };
}

/**
 * Keep My Plan courses aligned with courses added from Learning Resources.
 * Progress is preserved for courses that remain in the list.
 */
export async function syncPlanWithLearningCourses(
  savedIds?: string[],
): Promise<PlanState> {
  const owner = currentWorkspaceSession();
  const directory = await loadCourseDirectory();
  if (owner !== currentWorkspaceSession())
    throw new Error("Your account changed. Reload before changing saved courses.");
  const previous = readPlanState();
  const next = planForSavedCourses(savedIds ?? readLibrary().saved, directory, previous);
  savePlanState(next);
  return next;
}

export function planForSavedCourses(
  savedIds: string[],
  directory: Map<string, CatalogueCourse>,
  previous: PlanState,
): PlanState {
  const previousById = new Map(previous.courses.map((course) => [course.id, course]));
  const courses = savedIds.flatMap((id) => {
    const catalogue = directory.get(id);
    const existing = previousById.get(id);
    // Keep recorded progress when a saved course temporarily leaves the catalogue.
    return catalogue ? [catalogueToPlanCourse(catalogue, existing)] : existing ? [existing] : [];
  });
  return { ...previous, courses };
}

/** @deprecated Prefer syncPlanWithLearningCourses. */
export async function commitLearningCoursesToPlan(
  savedIds?: string[],
): Promise<PlanState> {
  return syncPlanWithLearningCourses(savedIds);
}
