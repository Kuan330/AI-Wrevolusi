import { accountStorage } from "@/services/accountStorage";

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

const LEARNING_CENTRE_KEY = "aiwrevolusi.learningCentre";

export const readLearningCentreItems = (): LearningCentreItem[] => {
  try {
    const parsed = JSON.parse(
      accountStorage.getItem(LEARNING_CENTRE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed) ? (parsed as LearningCentreItem[]) : [];
  } catch {
    return [];
  }
};
