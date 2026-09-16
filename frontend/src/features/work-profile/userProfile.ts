import { accountStorage } from "../../infrastructure/storage/accountStorage.ts";
import { STORAGE_KEYS } from "../../infrastructure/storage/keys.ts";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import type { ReferenceOccupation } from "@/types/reference";

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
    parseJson<ConfirmedAnalysis>(
      accountStorage.getItem(STORAGE_KEYS.confirmedAnalysis),
    ) ?? null;
  if (!parsed?.occupationTitle || !Array.isArray(parsed.tasks)) return null;
  return parsed;
};

export const readUserProfile = (): UserProfile => {
  const stored = parseJson<UserProfile>(
    accountStorage.getItem(STORAGE_KEYS.userProfile),
  );
  if (stored) {
    const cleaned: UserProfile = {
      tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
      tasksOccupationCode: stored.tasksOccupationCode ?? null,
      analysis: stored.analysis ?? null,
    };
    accountStorage.removeItem(STORAGE_KEYS.selectedOccupation);

    return cleaned;
  }

  const analysis = readLegacyAnalysis();
  const migrated: UserProfile = {
    tasks: analysis?.tasks ?? [],
    tasksOccupationCode: analysis?.occupationCode ?? null,
    analysis,
  };
  accountStorage.removeItem(STORAGE_KEYS.selectedOccupation);
  return migrated;
};

export const writeUserProfile = (patch: Partial<UserProfile>): UserProfile => {
  const previous = readUserProfile();
  const next = { ...previous, ...patch };
  if (
    JSON.stringify(previous.analysis) !== JSON.stringify(next.analysis) ||
    previous.tasksOccupationCode !== next.tasksOccupationCode ||
    JSON.stringify(previous.tasks) !== JSON.stringify(next.tasks)
  ) {
    const rawLibrary = accountStorage.getItem(STORAGE_KEYS.courseLibrary);
    if (rawLibrary) {
      try {
        const library = JSON.parse(rawLibrary);
        accountStorage.setItem(
          STORAGE_KEYS.courseLibrary,
          JSON.stringify({
            ...library,
            saved: [],
            choices: {},
            basis: {},
            workContext: next.analysis ? JSON.stringify(next.analysis) : "",
          }),
        );
        accountStorage.removeItem(STORAGE_KEYS.planner);
        accountStorage.removeItem(STORAGE_KEYS.learningResourceSelections);
      } catch {
        accountStorage.removeItem(STORAGE_KEYS.courseLibrary);
      }
    }
  }
  accountStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(next));
  accountStorage.removeItem(STORAGE_KEYS.selectedOccupation);
  if (next.analysis) {
    accountStorage.setItem(
      STORAGE_KEYS.confirmedAnalysis,
      JSON.stringify(next.analysis),
    );
  } else {
    accountStorage.removeItem(STORAGE_KEYS.confirmedAnalysis);
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
  accountStorage.removeItem(STORAGE_KEYS.selectedOccupation);
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
