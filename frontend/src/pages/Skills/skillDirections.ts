import { accountStorage } from "@/services/accountStorage";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";

export const SKILL_DIRECTIONS = ["keep_building", "strengthen", "use_with_ai"] as const;

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

const hasMeaningfulAiCapacity = (category: string | null): boolean =>
  category === "Low-Moderate" ||
  category === "Moderate" ||
  category === "Moderate-High" ||
  category === "High";

export const recommendedDirection = ({ skill }: SkillEvidence): SkillDirection => {
  if (hasMeaningfulAiCapacity(skill.genai_substitution_capacity_category)) {
    return "use_with_ai";
  }

  const importance = skill.core_skill_importance_2025_pct;
  const outlook = skill.future_net_increase_2025_2030;
  if (typeof outlook === "number" && outlook > 20 && (importance ?? 0) < 50) {
    return "strengthen";
  }

  return "keep_building";
};

export const buildRecommendedDirections = (
  evidence: SkillEvidence[],
): SkillDirectionAssignments =>
  Object.fromEntries(
    evidence.map((item) => [item.skill.wef_skill_id, recommendedDirection(item)]),
  );

export const readLearningCentreItems = (): LearningCentreItem[] => {
  try {
    const parsed = JSON.parse(accountStorage.getItem(LEARNING_CENTRE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as LearningCentreItem[]) : [];
  } catch {
    return [];
  }
};

export const addLearningCentreItems = (themes: LearningTheme[]): LearningCentreItem[] => {
  const current = readLearningCentreItems();
  const topicKey = (item: Pick<LearningTheme, "skill_id" | "title">) =>
    `${item.skill_id}:${item.title.trim().toLocaleLowerCase()}`;
  const byTopic = new Map(current.map((item) => [topicKey(item), item]));
  const addedAt = new Date().toISOString();
  themes.forEach((theme) =>
    byTopic.set(topicKey(theme), { ...theme, added_at: addedAt }),
  );
  const next = [...byTopic.values()];
  accountStorage.setItem(LEARNING_CENTRE_KEY, JSON.stringify(next));
  return next;
};

export const removeLearningCentreItem = (themeId: string): LearningCentreItem[] => {
  const next = readLearningCentreItems().filter((item) => item.theme_id !== themeId);
  accountStorage.setItem(LEARNING_CENTRE_KEY, JSON.stringify(next));
  return next;
};
