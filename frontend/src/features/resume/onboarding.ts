import type { ResumeDocument } from "./types.ts";

export type GenerationAction = "ai" | null;
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
  if (!input.skillCount && !input.factCount) return null;
  return input.aiConfigured === false ? null : "ai";
}

export function emptyResumeDocument(): ResumeDocument {
  return { cv: { sections: { Skills: [] } }, design: { theme: "engineeringresumes" } };
}
