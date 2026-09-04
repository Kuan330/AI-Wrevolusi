import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import type { ConfirmedCapabilityProfile } from "@/types/capability";
import type { ReferenceOccupation } from "@/types/reference";

const PROFILE_KEY = "aiwrevolusi.userProfile";
const OCCUPATION_KEY = "aiwrevolusi.selectedOccupation";
const ANALYSIS_KEY = "aiwrevolusi.confirmedAnalysis";

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
  capabilityProfile?: ConfirmedCapabilityProfile | null;
};

export type UserProfile = {
  occupation: SelectedOccupation | null;
  tasks: ProfileTask[];
  tasksOccupationCode: string | null;
  referenceDataVersion: string | null;
  removedReferenceTaskIds: string[];
  analysis: ConfirmedAnalysis | null;
};

const emptyProfile = (): UserProfile => ({
  occupation: null,
  tasks: [],
  tasksOccupationCode: null,
  referenceDataVersion: null,
  removedReferenceTaskIds: [],
  analysis: null,
});

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readLegacyOccupation = (): SelectedOccupation | null => {
  const parsed =
    parseJson<SelectedOccupation>(localStorage.getItem(OCCUPATION_KEY)) ??
    parseJson<SelectedOccupation>(sessionStorage.getItem(OCCUPATION_KEY));
  if (!parsed?.unit?.occupation_code || !parsed.unit.title) return null;
  return parsed;
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
  if (stored?.occupation || stored?.analysis || stored?.tasksOccupationCode) {
    return { ...emptyProfile(), ...stored };
  }

  const occupation = readLegacyOccupation();
  const analysis = readLegacyAnalysis();
  const migrated: UserProfile = {
    occupation,
    tasks: analysis?.tasks ?? [],
    tasksOccupationCode: analysis?.occupationCode ?? occupation?.unit.occupation_code ?? null,
    referenceDataVersion: null,
    removedReferenceTaskIds: [],
    analysis,
  };
  if (occupation || analysis) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(migrated));
  }
  return migrated;
};

export const writeUserProfile = (patch: Partial<UserProfile>): UserProfile => {
  const next = { ...readUserProfile(), ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  if (next.occupation) {
    localStorage.setItem(OCCUPATION_KEY, JSON.stringify(next.occupation));
  }
  if (next.analysis) {
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify(next.analysis));
  } else {
    localStorage.removeItem(ANALYSIS_KEY);
  }
  return next;
};

export const saveSelectedOccupation = (occupation: SelectedOccupation) => {
  const prev = readUserProfile();
  const same = prev.occupation?.unit.occupation_code === occupation.unit.occupation_code;
  writeUserProfile({
    occupation,
    tasks: same ? prev.tasks : [],
    tasksOccupationCode: same ? prev.tasksOccupationCode : null,
    referenceDataVersion: same ? prev.referenceDataVersion : null,
    removedReferenceTaskIds: same ? prev.removedReferenceTaskIds : [],
    analysis: same ? prev.analysis : null,
  });
};

export const readSelectedOccupation = (): SelectedOccupation | null =>
  readUserProfile().occupation ?? readLegacyOccupation();

type ProfileTaskCacheMetadata = Pick<
  UserProfile,
  "referenceDataVersion" | "removedReferenceTaskIds"
>;

export const saveProfileTasks = (
  occupationCode: string,
  tasks: ProfileTask[],
  metadata: Partial<ProfileTaskCacheMetadata> = {},
) => {
  writeUserProfile({ tasks, tasksOccupationCode: occupationCode, analysis: null, ...metadata });
};

export const readProfileTaskCache = (
  occupationCode: string,
): ({ tasks: ProfileTask[] } & ProfileTaskCacheMetadata) | null => {
  const profile = readUserProfile();
  if (profile.tasksOccupationCode !== occupationCode) return null;
  return {
    tasks: profile.tasks,
    referenceDataVersion: profile.referenceDataVersion,
    removedReferenceTaskIds: profile.removedReferenceTaskIds,
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

export const readConfirmedCapabilityProfile = (): ConfirmedCapabilityProfile | null =>
  readConfirmedAnalysis()?.capabilityProfile ?? null;

export const saveConfirmedCapabilityProfile = (
  capabilityProfile: ConfirmedCapabilityProfile,
): ConfirmedCapabilityProfile | null => {
  const analysis = readConfirmedAnalysis();
  if (!analysis) return null;
  saveConfirmedAnalysis({ ...analysis, capabilityProfile });
  return capabilityProfile;
};

export const hasConfirmedAnalysis = (): boolean => {
  const analysis = readConfirmedAnalysis();
  return Boolean(analysis && analysis.tasks.length > 0);
};
