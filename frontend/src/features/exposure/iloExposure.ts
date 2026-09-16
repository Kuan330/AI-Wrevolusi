/** ILO Working Paper 140 (2025), Table 5, p. 38.
 * Categories use occupational mean (μ) AND SD (σ), not a single task score.
 * Published potential25 values are authoritative.
 */
export const IloOccupationExposure = {
  NotExposed: "Not Exposed",
  MinimalExposure: "Minimal Exposure",
  Gradient1: "Exposed: Gradient 1",
  Gradient2: "Exposed: Gradient 2",
  Gradient3: "Exposed: Gradient 3",
  Gradient4: "Exposed: Gradient 4",
} as const;
export type IloOccupationExposure = (typeof IloOccupationExposure)[keyof typeof IloOccupationExposure];

export const ILO_EXPOSURE_METHOD_URL = "https://brasil.un.org/pt-br/download/184208/294688#page=41";

export const ILO_OCCUPATION_EXPOSURES = [
  { value: IloOccupationExposure.NotExposed, description: "Low occupational exposure; none of the other category conditions apply.", rule: "None of the other category conditions apply." },
  { value: IloOccupationExposure.MinimalExposure, description: "Low exposure with moderate variation between tasks.", rule: "μ < 0.5 and μ + σ > 0.4, outside Gradients 1–4." },
  { value: IloOccupationExposure.Gradient1, description: "Low overall exposure with high variation between tasks.", rule: "μ < 0.4 and μ + σ ≥ 0.5." },
  { value: IloOccupationExposure.Gradient2, description: "Moderate exposure with high variation between tasks.", rule: "0.4 ≤ μ < 0.5 and μ + σ ≥ 0.5." },
  { value: IloOccupationExposure.Gradient3, description: "Significant exposure with high variation between tasks.", rule: "0.5 ≤ μ < 0.6 and μ + σ ≥ 0.5." },
  { value: IloOccupationExposure.Gradient4, description: "Highest exposure, consistent across tasks with low variation.", rule: "μ ≥ 0.6 and μ − σ ≥ 0.5." },
] as const;

export const parseIloOccupationExposure = (value: string | null | undefined): IloOccupationExposure | null =>
  ILO_OCCUPATION_EXPOSURES.find((category) => category.value === value)?.value ?? null;

export const referenceOccupationCategory = (
  task: { potential25?: string | null },
  assessment?: { potential25?: string | null } | null,
): IloOccupationExposure | null =>
  parseIloOccupationExposure(assessment?.potential25) ?? parseIloOccupationExposure(task.potential25);

export const countOccupationCategories = <T extends { id: string; potential25?: string | null }>(
  tasks: readonly T[],
  assessments: ReadonlyMap<string, { potential25?: string | null }>,
) => {
  const counts = Object.fromEntries(ILO_OCCUPATION_EXPOSURES.map(({ value }) => [value, 0])) as Record<IloOccupationExposure, number>;
  let unclassified = 0;
  for (const task of tasks) {
    const category = referenceOccupationCategory(task, assessments.get(task.id));
    if (category) counts[category] += 1;
    else unclassified += 1;
  }
  return { counts, total: tasks.length, unclassified };
};
