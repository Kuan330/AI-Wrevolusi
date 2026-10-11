import { accountStorage } from "./accountStorage.ts";

export const DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
export type CareerDirection = { occupation_code: string; title?: string; skill_id?: number; skillSources?: Record<string, string> };

export function readCareerDirection(): CareerDirection | null {
  const raw = accountStorage.getItem(DIRECTION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value === null) return null;
    if (!value || typeof value !== "object" || typeof value.occupation_code !== "string" || !value.occupation_code.trim() || value.occupation_code.length > 100) throw new Error();
    return value as CareerDirection;
  } catch {
    throw new Error("Your saved career direction could not be read. Choose a career direction again.");
  }
}

export function saveCareerDirection(direction: CareerDirection): void {
  accountStorage.setItem(DIRECTION_KEY, JSON.stringify(direction));
}
