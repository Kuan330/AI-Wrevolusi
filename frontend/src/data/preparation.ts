import type { PreparationPriority } from "@/types/preparation";

export const mockPreparation: PreparationPriority[] = [
  {
    id: "prep-1",
    title: "Strengthen prompt-based reporting review",
    rationale: "Weekly reporting is partly automated and needs quality checks.",
    effortLevel: 3,
    priority: "high",
  },
  {
    id: "prep-2",
    title: "Build coaching playbook with AI examples",
    rationale: "Team support remains human-led but can be accelerated by AI drafts.",
    effortLevel: 2,
    priority: "medium",
  },
];
