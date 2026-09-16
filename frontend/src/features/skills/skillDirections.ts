import { accountStorage } from "@/infrastructure/storage/accountStorage";
import { STORAGE_KEYS } from "@/infrastructure/storage/keys";

export const SKILL_DIRECTIONS = [
  "keep_building",
  "strengthen",
  "use_with_ai",
] as const;

export type SkillDirection = (typeof SKILL_DIRECTIONS)[number];
export type SkillDirectionAssignments = Record<number, SkillDirection>;

export type LearningTheme = {
  source?: "template" | "backend";
  theme_id: string;
  skill_id: number;
  skill_name: string;
  direction: SkillDirection;
  title: string;
  description: string;
  why_relevant: string;
};

export type LearningCentreItem = LearningTheme & {
  added_at: string;
};

export const readLearningCentreItems = (): LearningCentreItem[] => {
  try {
    const parsed = JSON.parse(
      accountStorage.getItem(STORAGE_KEYS.learningCentre) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed) ? (parsed as LearningCentreItem[]) : [];
  } catch {
    return [];
  }
};
