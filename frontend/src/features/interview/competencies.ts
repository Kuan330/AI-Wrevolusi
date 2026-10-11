import type { CompetencyId, Level } from "./types.ts";

/** The skills a practice answer can show. Same ids as the backend rubric. */
export const COMPETENCIES: { id: CompetencyId; label: string; hint: string }[] = [
  { id: "role_knowledge", label: "Role know-how", hint: "Uses the facts and methods of the work and says why a choice fits." },
  { id: "problem_solving", label: "Problem solving", hint: "Breaks a problem into steps, weighs options and explains the choice." },
  { id: "communication", label: "Clear communication", hint: "Explains things so others can act on them." },
  { id: "quality_care", label: "Quality and care", hint: "Checks accuracy, follows procedures and keeps people or data safe." },
  { id: "teamwork", label: "Teamwork and leading", hint: "Works with others and handles disagreement." },
  { id: "learning", label: "Learning and adapting", hint: "Learns from mistakes or new tasks and says what changed." },
  { id: "ownership", label: "Ownership", hint: "Says what you personally did, not only what the team did." },
  { id: "results", label: "Results", hint: "Says what changed because of the work, with a fact or number." },
  { id: "ai_change", label: "Working with AI and change", hint: "Explains how a task may change with AI and how output would be checked." },
];
export const competencyLabel = (id: CompetencyId) => COMPETENCIES.find(item => item.id === id)?.label ?? id;
export const LEVEL_LABEL: Record<Level, string> = { 1: "Not shown yet", 2: "Started", 3: "Clear", 4: "Strong" };
