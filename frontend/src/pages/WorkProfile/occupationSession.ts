import type { ReferenceOccupation } from "@/types/reference";

const STORAGE_KEY = "aiwrevolusi.selectedOccupation";

export type SelectedOccupation = {
  unit: ReferenceOccupation;
  path: ReferenceOccupation[];
};

export const saveSelectedOccupation = (value: SelectedOccupation) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const readSelectedOccupation = (): SelectedOccupation | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedOccupation;
    if (!parsed?.unit?.occupation_code || !parsed.unit.title) return null;
    return parsed;
  } catch {
    return null;
  }
};
