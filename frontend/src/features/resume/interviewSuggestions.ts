import { entryLabel } from "./review.ts";
import type { InterviewSuggestion, ResumeDocument, ResumeDraft, ResumeEntry } from "./types.ts";

const MAX_SUGGESTIONS = 30;
const isMapping = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

/** Add a suggestion. The resume content itself is not touched. */
export function addInterviewSuggestion(draft: ResumeDraft, suggestion: InterviewSuggestion): ResumeDraft {
  const text = suggestion.text.trim();
  if (!text) throw new Error("Write the point you want to send to your resume first.");
  const current = (draft.interviewSuggestions ?? []).filter(item => item.id !== suggestion.id);
  return { ...draft, interviewSuggestions: [...current, { ...suggestion, text }].slice(-MAX_SUGGESTIONS) };
}
export const dismissInterviewSuggestion = (draft: ResumeDraft, id: string): ResumeDraft =>
  ({ ...draft, interviewSuggestions: (draft.interviewSuggestions ?? []).filter(item => item.id !== id) });

/** Where the suggestion belongs now, or null if that entry changed or was removed. */
export function suggestionTarget(document: ResumeDocument, suggestion: InterviewSuggestion): ResumeEntry | null {
  const entry = document.cv.sections?.[suggestion.section]?.[suggestion.entryIndex];
  return entry !== undefined && entryLabel(entry) === suggestion.entryLabel ? entry : null;
}

/** The user's own words, added to the matching entry. Only runs when the user accepts. */
export function applyInterviewSuggestion(document: ResumeDocument, suggestion: InterviewSuggestion): ResumeDocument {
  const entry = suggestionTarget(document, suggestion);
  if (entry === null) throw new Error("This entry has changed since practice. Dismiss the suggestion or add the point by hand.");
  const text = suggestion.text.trim();
  const next = structuredClone(document);
  const entries = next.cv.sections![suggestion.section];
  const index = suggestion.entryIndex;
  if (typeof entry === "string") entries.splice(index + 1, 0, text);
  else if (isMapping(entry) && "bullet" in entry) entries.splice(index + 1, 0, { bullet: text });
  else if (isMapping(entry) && "details" in entry && "label" in entry) entries[index] = { ...entry, details: `${String(entry.details ?? "").trim()} ${text}`.trim() };
  else {
    const old = entries[index] as Record<string, unknown>;
    entries[index] = { ...old, highlights: [...(Array.isArray(old.highlights) ? old.highlights as unknown[] : []), text] };
  }
  return next;
}
