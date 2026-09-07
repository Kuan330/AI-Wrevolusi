import { buildLearningThemeTemplates } from "@/pages/Skills/lib/learningThemeTemplates";
import { api } from "@/services/api";
import type { LearningTheme, SkillDirection } from "@/pages/Skills/skillDirections";

export type SkillDirectionAnalysisItem = {
  skill_id: number;
  skill_name: string;
  direction: SkillDirection;
  supporting_tasks: string[];
  current_importance_pct: number | null;
  future_outlook_points: number | null;
  genai_capacity: string | null;
};

type SkillDirectionAnalysisResponse = {
  themes: LearningTheme[];
};

export const useLocalLearningTemplates = import.meta.env.VITE_SKILL_ANALYSIS_MODE !== "backend";

export const skillDirectionService = {
  analyse: (occupationTitle: string, skills: SkillDirectionAnalysisItem[]) =>
    useLocalLearningTemplates
      ? Promise.resolve<SkillDirectionAnalysisResponse>({ themes: buildLearningThemeTemplates(skills) })
      : api.post<SkillDirectionAnalysisResponse>(
      "/skill-directions/analyse",
      { occupation_title: occupationTitle, skills },
      65000,
    ),
};
