import type { ProfileTask } from "@/pages/WorkProfile/types";

const STORAGE_KEY = "aiwrevolusi.confirmedAnalysis";

export type ConfirmedAnalysis = {
  occupationTitle: string;
  occupationPath: string[];
  occupationCode: string;
  potential25: string | null;
  meanScore2025: number | null;
  tasks: ProfileTask[];
};

export const saveConfirmedAnalysis = (value: ConfirmedAnalysis) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const readConfirmedAnalysis = (): ConfirmedAnalysis | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConfirmedAnalysis;
    if (!parsed?.occupationTitle || !Array.isArray(parsed.tasks)) return null;
    return parsed;
  } catch {
    return null;
  }
};
