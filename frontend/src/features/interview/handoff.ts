import { startLearning } from "../journey/journey.ts";
import { addInterviewSuggestion, suggestionTarget } from "../resume/interviewSuggestions.ts";
import { loadResumeDraft, saveResumeDraft } from "../resume/repository.ts";
import type { InterviewSuggestion } from "../resume/types.ts";
import type { InterviewItem } from "./types.ts";

/** Same rule as the backend, so the skill matches the learning catalogue. */
export const skillSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");

export type ResumeHandoff = { sessionId: string; questionId: string; attemptId: string; question: string; item: InterviewItem; text: string };
/** Offer a point from an answer on its resume entry. The resume only changes when the user accepts it there. */
export async function sendAnswerToResume(owner: string, input: ResumeHandoff, isCurrent: () => boolean = () => true): Promise<void> {
  if (!input.item.ref) throw new Error("This question is not linked to a resume entry.");
  const text = input.text.trim();
  if (!text) throw new Error("Write the point you want to send to your resume first.");
  const draft = await loadResumeDraft(owner);
  if (!draft.document) throw new Error("Your resume draft was not found. Open the Resume builder first.");
  const suggestion: InterviewSuggestion = {
    id: `${input.sessionId}:${input.questionId}:${input.attemptId}`, sessionId: input.sessionId, createdAt: new Date().toISOString(),
    section: input.item.ref.section, entryIndex: input.item.ref.index, entryLabel: input.item.label, text: text.slice(0, 1200), question: input.question.slice(0, 400),
  };
  if (suggestionTarget(draft.document, suggestion) === null) throw new Error("That resume entry has changed since this practice. Open the Resume builder and add the point there.");
  await saveResumeDraft(owner, addInterviewSuggestion(draft, suggestion), draft.revision, isCurrent);
}

export type LearningHandoff = { skill: { id: number; name: string }; career: { code: string; title: string } | null; roleTitle: string };
/** Open learning resources for a skill the user confirmed. Nothing is added to the learning plan here. */
export function startStrengthening(input: LearningHandoff): Promise<string> {
  return startLearning({
    origin: input.career ? "career" : "browse",
    skill: { id: input.skill.id, slug: skillSlug(input.skill.name), name: input.skill.name },
    ...(input.career ? { career: input.career } : {}),
    goal: `Strengthen ${input.skill.name}${input.roleTitle ? ` for ${input.roleTitle}` : ""}`.slice(0, 300),
  });
}
