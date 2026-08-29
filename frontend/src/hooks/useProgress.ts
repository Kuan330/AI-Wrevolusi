import { useMemo } from "react";

import { calculateCompletionRate } from "@/utils/calculation";

export interface ProgressInput {
  label: string;
  completed: number;
  total: number;
}

export const useProgress = (steps: ProgressInput[]) => {
  const overall = useMemo(() => {
    const completed = steps.reduce((sum, step) => sum + step.completed, 0);
    const total = steps.reduce((sum, step) => sum + step.total, 0);

    return calculateCompletionRate(completed, total);
  }, [steps]);

  return {
    overall,
    byStep: steps.map((step) => ({
      ...step,
      percent: calculateCompletionRate(step.completed, step.total),
    })),
  };
};
