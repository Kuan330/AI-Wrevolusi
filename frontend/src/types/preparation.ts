export type PriorityLevel = "high" | "medium" | "low";

export interface PreparationPriority {
  id: string;
  title: string;
  rationale: string;
  effortLevel: number;
  priority: PriorityLevel;
}
