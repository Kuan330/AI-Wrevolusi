import type { recommendSkills } from "./recommendations.ts";

export type SkillRecommendation = ReturnType<typeof recommendSkills>[number];

/** Lines explain shared work evidence, never a prerequisite or skill level. */
export function buildSkillPath(recommendations: SkillRecommendation[]) {
  const start = recommendations[0] ?? null;
  const taskIds = new Set(start?.tasks.map(task => task.id));
  const connected = recommendations.slice(1).filter(item => item.tasks.some(task => taskIds.has(task.id))).slice(0, 2);
  const connectedIds = new Set(connected.map(item => item.skill.wef_skill_id));
  const additional = recommendations.slice(1).filter(item => !connectedIds.has(item.skill.wef_skill_id));
  return { start, connected, additional };
}

const DESCRIPTIONS: Record<number, string> = {
  1: "Find patterns, weigh the evidence and make clearer decisions.",
  2: "Adapt your approach when priorities, tools or working conditions change.",
  3: "Help people work towards a shared goal and make decisions together.",
  4: "Explore different approaches and turn new ideas into useful solutions.",
  5: "Understand your strengths and build habits that help you work independently.",
  6: "Choose and use digital tools with more confidence in your everyday work.",
  7: "Listen carefully and understand what other people need.",
  8: "Ask useful questions and build a habit of learning as your work changes.",
  9: "Help people develop their strengths and contribute to a team.",
  10: "Understand customer needs and respond with useful, clear support.",
  11: "Use AI and data thoughtfully, and check the quality of their outputs.",
  12: "See how different parts of a process affect one another.",
  13: "Organise resources and improve how everyday work gets done.",
  14: "Check the details and produce work that other people can rely on.",
  15: "Review quality, safety and standards before work is put into use.",
  16: "Explain ideas and help others practise new skills.",
  17: "Protect information and understand the risks of connected systems.",
  18: "Shape products and experiences around the people who use them.",
  19: "Communicate and work across different languages.",
  20: "Create clear messages for the people you want to reach.",
  21: "Read, write and work with numbers to explain information clearly.",
  22: "Understand how everyday decisions affect the environment.",
  23: "Build, test and improve software that solves a practical problem.",
  24: "Carry out physical tasks with control, care and precision.",
  25: "Work respectfully with people from different backgrounds.",
  26: "Notice and interpret the sensory details that matter in your work.",
};

export function skillPathDescription(skillId: number) {
  return DESCRIPTIONS[skillId] ?? "Explore a skill connected to your confirmed work and choose a useful way to practise.";
}
