import { accountStorage } from "../../services/accountStorage.ts";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import type { ReferenceOccupation } from "@/types/reference";

const PROFILE_KEY = "aiwrevolusi.userProfile";
const OCCUPATION_KEY = "aiwrevolusi.selectedOccupation";
const ANALYSIS_KEY = "aiwrevolusi.confirmedAnalysis";

/** Workspace keys that are derived from a confirmed occupation + analysis. */
const WORK_DERIVED_KEYS = [
  ANALYSIS_KEY,
  "aiwrevolusi.learningCentre",
  "aiwrevolusi.learningResourceSelections.v1",
  "aiwrevolusi.courseLibrary.v1",
  "aiwrevolusi.learningSkills.v1",
  "aiwrevolusi.plan.courses.v1",
  "aiwrevolusi.planner.v1",
  "aiwrevolusi.possibilities.chosenDirection",
  "aiwrevolusi.possibilities.shortlist",
  "aiwrevolusi.possibilities.saved",
  "aiwrevolusi.possibilities.intent",
] as const;

let transientSelectedOccupation: SelectedOccupation | null = null;

export type SelectedOccupation = {
  unit: ReferenceOccupation;
  path: ReferenceOccupation[];
};

export type ConfirmedAnalysis = {
  occupationTitle: string;
  occupationPath: string[];
  occupationCode: string;
  potential25: string | null;
  meanScore2025: number | null;
  tasks: ProfileTask[];
  taskExposureAssessments: ConfirmedTaskExposureAssessment[];
};

export type UserProfile = {
  tasks: ProfileTask[];
  tasksOccupationCode: string | null;
  analysis: ConfirmedAnalysis | null;
};

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readLegacyAnalysis = (): ConfirmedAnalysis | null => {
  const parsed =
    parseJson<ConfirmedAnalysis>(accountStorage.getItem(ANALYSIS_KEY)) ?? null;
  if (!parsed?.occupationTitle || !Array.isArray(parsed.tasks)) return null;
  return parsed;
};

/** Drop plans, learning choices, and Possibilities state tied to the old role. */
export const clearWorkDerivedData = () => {
  for (const key of WORK_DERIVED_KEYS) {
    accountStorage.removeItem(key);
  }
};

export const readUserProfile = (): UserProfile => {
  const stored = parseJson<UserProfile>(accountStorage.getItem(PROFILE_KEY));
  if (stored) {
    const cleaned: UserProfile = {
      tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
      tasksOccupationCode: stored.tasksOccupationCode ?? null,
      analysis: stored.analysis ?? null,
    };
    accountStorage.removeItem(OCCUPATION_KEY);

    return cleaned;
  }

  const analysis = readLegacyAnalysis();
  const migrated: UserProfile = {
    tasks: analysis?.tasks ?? [],
    tasksOccupationCode: analysis?.occupationCode ?? null,
    analysis,
  };
  accountStorage.removeItem(OCCUPATION_KEY);
  return migrated;
};

export const writeUserProfile = (patch: Partial<UserProfile>): UserProfile => {
  const previous = readUserProfile();
  const next = { ...previous, ...patch };
  const occupationChanged =
    previous.tasksOccupationCode !== next.tasksOccupationCode;
  const analysisCleared = Boolean(previous.analysis) && !next.analysis;
  const analysisChanged =
    JSON.stringify(previous.analysis) !== JSON.stringify(next.analysis);
  const tasksChanged =
    JSON.stringify(previous.tasks) !== JSON.stringify(next.tasks);

  if (occupationChanged || analysisCleared) {
    clearWorkDerivedData();
  } else if (analysisChanged || tasksChanged) {
    // Soft refresh of the same occupation: drop plan picks that assumed the
    // previous confirmed snapshot, but keep learning skills the user curated.
    accountStorage.removeItem("aiwrevolusi.courseLibrary.v1");
    accountStorage.removeItem("aiwrevolusi.planner.v1");
    accountStorage.removeItem("aiwrevolusi.learningResourceSelections.v1");
    accountStorage.removeItem("aiwrevolusi.plan.courses.v1");
  }

  accountStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  accountStorage.removeItem(OCCUPATION_KEY);
  if (next.analysis) {
    accountStorage.setItem(ANALYSIS_KEY, JSON.stringify(next.analysis));
  } else {
    accountStorage.removeItem(ANALYSIS_KEY);
  }
  return next;
};

export const saveSelectedOccupation = (occupation: SelectedOccupation) => {
  transientSelectedOccupation = occupation;
};

export const readSelectedOccupation = (): SelectedOccupation | null =>
  transientSelectedOccupation;

export const clearSelectedOccupation = () => {
  transientSelectedOccupation = null;
  accountStorage.removeItem(OCCUPATION_KEY);
};

/**
 * Start a new occupation flow. When the unit code changes, wipe the previous
 * tasks, confirmed analysis, and all derived journey data so the user re-analyses.
 */
export const beginOccupationChange = (occupation: SelectedOccupation) => {
  const previousCode = readUserProfile().tasksOccupationCode;
  const nextCode = occupation.unit.occupation_code;
  saveSelectedOccupation(occupation);

  if (previousCode === nextCode) {
    return { occupationChanged: false };
  }

  clearWorkDerivedData();
  // Leave tasksOccupationCode null so ProfileTasks loads fresh ILO starters
  // instead of treating an empty array as a saved empty list.
  writeUserProfile({
    tasks: [],
    tasksOccupationCode: null,
    analysis: null,
  });
  return { occupationChanged: true };
};

export const saveProfileTasks = (
  occupationCode: string,
  tasks: ProfileTask[],
) => {
  writeUserProfile({
    tasks,
    tasksOccupationCode: occupationCode,
    analysis: null,
  });
};

export const readProfileTasks = (
  occupationCode: string,
): ProfileTask[] | null => {
  const profile = readUserProfile();
  if (profile.tasksOccupationCode !== occupationCode) return null;
  return profile.tasks;
};

export const readTaskWorkspace = (): Pick<
  UserProfile,
  "tasks" | "tasksOccupationCode"
> | null => {
  const profile = readUserProfile();
  if (!profile.tasksOccupationCode || !Array.isArray(profile.tasks))
    return null;
  return {
    tasks: profile.tasks,
    tasksOccupationCode: profile.tasksOccupationCode,
  };
};

export const saveConfirmedAnalysis = (analysis: ConfirmedAnalysis) => {
  writeUserProfile({
    analysis,
    tasks: analysis.tasks,
    tasksOccupationCode: analysis.occupationCode,
  });
};

export const readConfirmedAnalysis = (): ConfirmedAnalysis | null =>
  readUserProfile().analysis;

export const hasConfirmedAnalysis = (): boolean => {
  const analysis = readConfirmedAnalysis();
  return Boolean(analysis && analysis.tasks.length > 0);
};

/** Practice updates keep confirmed exposure evidence and the task workspace in sync. */
export const saveTaskPractice = (
  occupationCode: string,
  taskId: string,
  taskWording: string,
  update: (
    current: import("./types").TaskPractice,
  ) => import("./types").TaskPractice,
): ConfirmedAnalysis => {
  const profile = readUserProfile();
  const task = profile.tasks.find((item) => item.id === taskId);
  if (
    profile.tasksOccupationCode !== occupationCode ||
    !profile.analysis ||
    profile.analysis.occupationCode !== occupationCode ||
    !task ||
    task.wording !== taskWording ||
    !profile.analysis.tasks.some(
      (item) => item.id === taskId && item.wording === taskWording,
    )
  ) {
    throw new Error(
      "This task changed. Reload the page before recording a trial.",
    );
  }
  const practice = update(task.practice ?? { trials: [] });
  const patchTask = (item: ProfileTask) =>
    item.id === taskId ? { ...item, practice } : item;
  const analysis = {
    ...profile.analysis,
    tasks: profile.analysis.tasks.map(patchTask),
  };
  writeUserProfile({ tasks: profile.tasks.map(patchTask), analysis });
  return analysis;
};
