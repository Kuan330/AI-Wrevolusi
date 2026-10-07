import type { ResumeDocument } from "./types.ts";

export const EXAMPLE_JOB_REQUIREMENTS = `Junior Data Analyst
Responsibilities and requirements:
- Clean, organise and analyse data using Excel and SQL.
- Use Python to support data analysis and automate routine tasks.
- Create clear charts and dashboards to communicate findings.
- Apply analytical thinking and attention to detail to identify trends and check data quality.
- Communicate insights clearly and collaborate with colleagues.`;

export type GenerationAction = "blank" | "ai" | null;
export function resumeGenerationAction(input: {
  jobRequirements: string;
  hasDocument: boolean;
  skillCount: number;
  factCount: number;
  skillsLoading: boolean;
  skillError: string;
  sourceReviewed: boolean | null;
  aiConfigured: boolean | null;
  busy: boolean;
}): GenerationAction {
  if (!input.jobRequirements.trim() || input.busy || input.skillsLoading || input.skillError || input.sourceReviewed === false) return null;
  if (!input.skillCount && !input.factCount) return input.hasDocument ? null : "blank";
  return input.aiConfigured === false ? null : "ai";
}

export function emptyResumeDocument(): ResumeDocument {
  return { cv: { sections: { Skills: [] } }, design: { theme: "engineeringresumes" } };
}
