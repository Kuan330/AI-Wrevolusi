export type EpicDefinition = {
  id: "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8";
  slug: string;
  title: string;
  usesAiMl: boolean;
  summary: string;
};

export const epicDefinitions: EpicDefinition[] = [
  {
    id: "E1",
    slug: "describe-and-confirm-my-work",
    title: "Describe and Confirm My Work",
    usesAiMl: false,
    summary: "Capture current role details and confirm the current work profile.",
  },
  {
    id: "E2",
    slug: "understand-how-ai-may-change-my-tasks",
    title: "Understand How AI May Change My Tasks",
    usesAiMl: true,
    summary: "Use NLP task matching and task classification to estimate task changes.",
  },
  {
    id: "E3",
    slug: "recognise-my-existing-capabilities",
    title: "Recognise My Existing Capabilities",
    usesAiMl: true,
    summary: "Use NLP capability recognition and text matching from known tasks.",
  },
  {
    id: "E4",
    slug: "review-and-correct-the-results",
    title: "Review and Correct the Results",
    usesAiMl: false,
    summary: "Allow review and correction across all Epic outputs.",
  },
  {
    id: "E5",
    slug: "explore-possible-career-directions",
    title: "Explore Possible Career Directions",
    usesAiMl: true,
    summary: "Use capability matching and pathway ranking for related occupations.",
  },
  {
    id: "E6",
    slug: "choose-what-to-prepare-first",
    title: "Choose What to Prepare First",
    usesAiMl: true,
    summary: "Use personalised priority ranking for what to prepare first.",
  },
  {
    id: "E7",
    slug: "take-practical-preparation-actions",
    title: "Take Practical Preparation Actions",
    usesAiMl: false,
    summary: "Guide practical preparation actions linked to selected priorities.",
  },
  {
    id: "E8",
    slug: "adjust-my-plan-to-fit-my-time",
    title: "Adjust My Plan to Fit My Time",
    usesAiMl: false,
    summary: "Adjust plans around changing work and care responsibilities.",
  },
];

export const epicBySlug = Object.fromEntries(
  epicDefinitions.map((epic) => [epic.slug, epic]),
);
