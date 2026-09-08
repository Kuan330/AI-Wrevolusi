import type { LearningTheme } from '../skillDirections';
import type { SkillDirectionAnalysisItem } from '@/services/skillDirectionService';

/** Deterministic starter themes; the backend uses the same LearningTheme contract. */
export function buildLearningThemeTemplates(skills: SkillDirectionAnalysisItem[]): LearningTheme[] {
  return skills.flatMap(skill => {
    const name = skill.skill_name;
    const examples = {
      keep_building: [
        { title: `Apply ${name} in everyday work`, description: `Choose a recurring task that uses ${name}. Define a useful outcome, practise your approach and reflect on what helped.` },
        { title: `Share and strengthen your ${name} practice`, description: `Create a short checklist or worked example of how you use ${name}. Ask a colleague for feedback and improve it.` },
      ],
      strengthen: [
        { title: `Build a foundation in ${name}`, description: `Review the core concepts of ${name}, then practise one technique with a small example from your work.` },
        { title: `Practise ${name} with feedback`, description: `Choose a slightly more challenging task, try the technique and review the result against clear criteria. Note what to practise next.` },
      ],
      use_with_ai: [
        { title: `Use AI to support ${name}`, description: `Explore how an AI assistant could support one part of a task involving ${name}. Prepare a non-sensitive example, describe the outcome and compare its draft with your own approach.` },
        { title: `Review AI output using ${name}`, description: `Practise checking an AI draft for accuracy, missing context and usefulness. Use ${name} to explain what you would keep, correct or reject.` },
      ],
    };
    return examples[skill.direction].map((theme, index) => ({
      ...theme,
      theme_id: `template-v1-${skill.skill_id}-${skill.direction}-${index + 1}`,
      skill_id: skill.skill_id,
      skill_name: name,
      direction: skill.direction,
      source: 'template',
      why_relevant: `A starter theme for your chosen direction in ${name}. Adapt it to a task you recognise; this is template guidance, not an AI assessment.`,
    }));
  });
}
