import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import type { ReferenceOccupation } from "@/types/reference";

const PROFILE_KEY = "aiwrevolusi.userProfile";
const OCCUPATION_KEY = "aiwrevolusi.selectedOccupation";
const ANALYSIS_KEY = "aiwrevolusi.confirmedAnalysis";

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

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readLegacyAnalysis = (): ConfirmedAnalysis | null => {
  const parsed =
    parseJson<ConfirmedAnalysis>(localStorage.getItem(ANALYSIS_KEY)) ??
    parseJson<ConfirmedAnalysis>(sessionStorage.getItem(ANALYSIS_KEY));
  if (!parsed?.occupationTitle || !Array.isArray(parsed.tasks)) return null;
  return parsed;
};

export const readUserProfile = (): UserProfile => {
  const stored = parseJson<UserProfile>(localStorage.getItem(PROFILE_KEY));
  if (stored) {
    const cleaned: UserProfile = {
      tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
      tasksOccupationCode: stored.tasksOccupationCode ?? null,
      analysis: stored.analysis ?? null,
    };
    localStorage.removeItem(OCCUPATION_KEY);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(cleaned));
    return cleaned;
  }

  const analysis = readLegacyAnalysis();
  const migrated: UserProfile = {
    tasks: analysis?.tasks ?? [],
    tasksOccupationCode: analysis?.occupationCode ?? null,
    analysis,
  };
  if (analysis) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(migrated));
  }
  localStorage.removeItem(OCCUPATION_KEY);
  return migrated;
};

export const writeUserProfile = (patch: Partial<UserProfile>): UserProfile => {
  const next = { ...readUserProfile(), ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  localStorage.removeItem(OCCUPATION_KEY);
  if (next.analysis) {
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify(next.analysis));
  } else {
    localStorage.removeItem(ANALYSIS_KEY);
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
  localStorage.removeItem(OCCUPATION_KEY);
};

export const saveProfileTasks = (occupationCode: string, tasks: ProfileTask[]) => {
  writeUserProfile({ tasks, tasksOccupationCode: occupationCode, analysis: null });
};

export const readProfileTasks = (occupationCode: string): ProfileTask[] | null => {
  const profile = readUserProfile();
  if (profile.tasksOccupationCode !== occupationCode) return null;
  return profile.tasks;
};

export const readTaskWorkspace = (): Pick<UserProfile, "tasks" | "tasksOccupationCode"> | null => {
  const profile = readUserProfile();
  if (!profile.tasksOccupationCode || !Array.isArray(profile.tasks)) return null;
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
