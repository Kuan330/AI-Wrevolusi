import type { WefSkill } from "@/types/reference";

const RULES: { pattern: RegExp; skillIds: number[] }[] = [
  { pattern: /customer|service|prompt|advis|sell|demonstrat|warranty|product use|product range/i, skillIds: [10, 7] },
  { pattern: /instruct|train|teach|hiring|interview|grievance|dismiss|promoting|evaluating staff/i, skillIds: [16, 9] },
  { pattern: /schedule|assigning|staff to specific|supervis|coordinat/i, skillIds: [3, 13] },
  { pattern: /inventory|stock|ordering|purchasing|wholesaler/i, skillIds: [13, 14] },
  { pattern: /budget|financial|invoice|payment|cash register|priced|price levels|records of/i, skillIds: [21, 1] },
  { pattern: /safety/i, skillIds: [14, 15] },
  { pattern: /returned goods|quality|appropriate action/i, skillIds: [15, 12] },
  { pattern: /product mix|determining prices|displaying goods/i, skillIds: [1, 18] },
  { pattern: /wrapping|packing|stacking/i, skillIds: [24, 14] },
];

export const skillsForTask = (taskText: string, skills: WefSkill[]): WefSkill[] => {
  const ids: number[] = [];
  for (const rule of RULES) {
    if (!rule.pattern.test(taskText)) continue;
    for (const id of rule.skillIds) {
      if (!ids.includes(id)) ids.push(id);
    }
    if (ids.length >= 2) break;
  }
  return ids
    .slice(0, 2)
    .map((id) => skills.find((skill) => skill.wef_skill_id === id))
    .filter((skill): skill is WefSkill => Boolean(skill));
};
