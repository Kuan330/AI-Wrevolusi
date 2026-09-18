import { currentWorkspaceSession, hasAccountWorkspace } from "../../services/accountStorage.ts";
import { getLearningProgress, postLearningCheckin, postLearningProgress, type LearningChapterProgress } from "../../services/learningService.ts";
import { readPlanState, savePlanState, type PlanState } from "./planCourses.ts";

const key = (item: LearningChapterProgress) => `${item.skill_id}:${item.course_id}:${item.chapter_index}`;
const assertOwner = (owner: number) => {
  if (owner !== currentWorkspaceSession()) throw new Error("Your account changed. Reload before continuing.");
};
const emptyRecord = () => ({ minutes: 0, note: "", studied: false, checked: false });

/** Persist the user's draft before any network call. Failed storage keeps the UI draft open. */
export function saveChapterProgress(courseId: string, values: number[], day: string): PlanState {
  const state = readPlanState();
  const course = state.courses.find(item => item.id === courseId);
  if (!course) throw new Error("This course changed. Reload before saving progress.");
  if (values.length !== course.chapters.length || values.some(value => !Number.isInteger(value) || value < 0 || value > 10))
    throw new Error("Choose valid chapter progress before saving.");
  if (hasAccountWorkspace() && !course.skillId) throw new Error("This course has no verified skill. Refresh the catalogue before saving progress.");
  const pending = new Map((state.pendingProgress ?? []).map(item => [key(item), item]));
  const record = state.records[day] ?? emptyRecord();
  const entries = new Map((record.entries ?? []).map(item => [`${item.courseId}:${item.chapterTitle}`, item]));
  let changed = false;
  const chapters = course.chapters.map((chapter, index) => {
    const value = Math.max(chapter.value, values[index]);
    if (value > chapter.value) {
      changed = true;
      entries.set(`${courseId}:${chapter.title}`, { courseId, courseTitle: course.title, chapterTitle: chapter.title, percent: value * 10 });
      if (hasAccountWorkspace() && course.skillId) {
        const item = { skill_id: course.skillId, course_id: courseId, chapter_index: index, value, local_date: day };
        pending.set(key(item), item);
      }
    }
    return { ...chapter, value };
  });
  if (!changed) return state;
  const next = {
    ...state,
    courses: state.courses.map(item => item.id === courseId ? { ...item, chapters } : item),
    records: { ...state.records, [day]: { ...record, studied: true, entries: [...entries.values()] } },
    pendingProgress: [...pending.values()],
    progressSyncError: "",
  };
  savePlanState(next);
  return next;
}

/** Server progress can raise local values, never lower a saved draft. */
function reconcile(state: PlanState, server: LearningChapterProgress[]): PlanState {
  const values = new Map(server.map(item => [key(item), item.value]));
  return {
    ...state,
    courses: state.courses.map(course => ({ ...course, chapters: course.chapters.map((chapter, index) => ({
      ...chapter,
      value: Math.max(chapter.value, values.get(key({ skill_id: course.skillId ?? "", course_id: course.id, chapter_index: index, value: 0 })) ?? 0),
    })) })),
  };
}

const pendingSaves = new Map<number, Promise<PlanState>>();
export function syncChapterProgress(): Promise<PlanState> {
  const owner = currentWorkspaceSession();
  const existing = pendingSaves.get(owner);
  if (existing) return existing;
  const request = sync(owner).finally(() => pendingSaves.delete(owner));
  pendingSaves.set(owner, request);
  return request;
}

async function sync(owner: number): Promise<PlanState> {
  if (!hasAccountWorkspace()) return readPlanState();
  try {
    // A second edit can arrive during a request. Re-read and drain only entries
    // that still need saving rather than replacing the user's newer snapshot.
    while (true) {
      assertOwner(owner);
      const pending = readPlanState().pendingProgress ?? [];
      if (!pending.length) return readPlanState();
      const day = pending[0].local_date;
      const batch = pending.filter(item => item.local_date === day).slice(0, 200);
      const result = await postLearningProgress(day, batch.map(({ local_date: _day, ...item }) => item));
      assertOwner(owner);
      const server = [...result.updated];
      for (const rejected of result.rejected) {
        const attempted = batch.find(item => item.course_id === rejected.course_id && item.chapter_index === rejected.chapter_index);
        if (attempted && typeof rejected.stored_value === "number") server.push({ ...attempted, value: rejected.stored_value });
      }
      const confirmed = new Map(server.map(item => [key(item), item.value]));
      const current = reconcile(readPlanState(), server);
      const remaining = (current.pendingProgress ?? []).filter(item => (confirmed.get(key(item)) ?? -1) < item.value);
      const unresolved = batch.some(item =>
        remaining.some(next => key(next) === key(item)) &&
        (confirmed.get(key(item)) ?? -1) < item.value,
      );
      const next = { ...current, pendingProgress: remaining, progressSyncError: unresolved ? "Some progress was not accepted. Your changes are kept. Refresh the catalogue, then retry." : "" };
      savePlanState(next);
      if (unresolved) throw new Error(next.progressSyncError);
    }
  } catch (error) {
    if (owner === currentWorkspaceSession()) {
      const message = error instanceof Error ? error.message : "Progress could not sync. Retry when connected.";
      // If storage itself failed, surface it instead of reporting a successful save.
      savePlanState({ ...readPlanState(), progressSyncError: message });
    }
    throw error;
  }
}

export async function refreshChapterProgress(): Promise<PlanState> {
  if (!hasAccountWorkspace()) return readPlanState();
  const owner = currentWorkspaceSession();
  const result = await getLearningProgress();
  assertOwner(owner);
  const next = reconcile(readPlanState(), result.chapters);
  // Reading current values does not acknowledge pending writes. Equal-value
  // retries do not change the original study date on the server.
  savePlanState(next);
  return next;
}

export async function checkInToPlan(day: string) {
  const owner = currentWorkspaceSession();
  await syncChapterProgress();
  assertOwner(owner);
  const result = await postLearningCheckin(day);
  assertOwner(owner);
  const current = readPlanState();
  const previous = current.records[day] ?? emptyRecord();
  const state = { ...current, records: { ...current.records, [day]: { ...previous, studied: true, checked: true } } };
  savePlanState(state);
  return { result, state };
}
