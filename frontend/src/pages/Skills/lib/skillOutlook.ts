export const capacityExplanation = (category: string | null): string => {
  if (category === "Very Low-Low" || category === "Low") {
    return "Research indicates limited GenAI capacity to substitute the central activities associated with this skill.";
  }
  if (category === "Low-Moderate" || category === "Moderate") {
    return "GenAI may support some routine parts, while context, judgement and responsibility still matter.";
  }
  if (category === "Moderate-High") {
    return "GenAI may support more of the routine activities associated with this skill, making effective use alongside AI increasingly relevant.";
  }
  return "The WEF reference does not show a GenAI capacity category for this skill.";
};

export const trendExplanation = (change: number | null): string => {
  if (typeof change !== "number") {
    return "There is not enough reference data to describe how use of this skill may change.";
  }
  if (change > 0) {
    return "More employers expect use of this skill to increase than decrease by 2030.";
  }
  if (change === 0) {
    return "Employer expectations for increasing and decreasing use of this skill are balanced.";
  }
  return "More employers expect use of this skill to decrease than increase by 2030.";
};

export const skillPosition = (
  importance: number | null | undefined,
  change: number | null,
) => {
  if (typeof importance !== "number" || typeof change !== "number") {
    return {
      label: "Position not available",
      explanation: "More reference data is needed to position this skill.",
    };
  }

  const widelyValued = importance >= 50;
  const growing = change > 20;

  if (widelyValued && growing) {
    return {
      label: "Established and growing",
      explanation:
        "This skill is already widely valued and expected to grow towards 2030.",
    };
  }
  if (growing) {
    return {
      label: "Emerging opportunity",
      explanation:
        "This skill is less widely considered core today, but employers expect its use to grow.",
    };
  }
  if (widelyValued) {
    return {
      label: "Established and evolving",
      explanation:
        "This skill is widely valued today, while its future use may be changing.",
    };
  }
  return {
    label: "Context dependent",
    explanation:
      "Its value may depend more on your role, industry and how it combines with other skills.",
  };
};
