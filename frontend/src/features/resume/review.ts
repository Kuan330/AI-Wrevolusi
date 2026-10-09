import { entryText } from "./document.ts";
import type { ResumeDraft, ResumeEntry, ReviewedMark } from "./types.ts";

/** Short, stable summary of what the user reviewed: the chapters and the target role. Personal fields are left out. */
export function resumeFingerprint(draft: Pick<ResumeDraft, "document" | "jobRequirements">): string {
  const text = JSON.stringify([draft.document?.cv.sections ?? {}, draft.jobRequirements.trim()]);
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

export type ReviewState = { status: "missing" | "needs-review" | "reviewed"; at?: string };
export function reviewState(draft: Pick<ResumeDraft, "document" | "jobRequirements" | "reviewed">): ReviewState {
  if (!draft.document) return { status: "missing" };
  if (!draft.reviewed || draft.reviewed.fingerprint !== resumeFingerprint(draft)) return { status: "needs-review" };
  return { status: "reviewed", at: draft.reviewed.at };
}
export const reviewedMark = (draft: Pick<ResumeDraft, "document" | "jobRequirements">, now = new Date()): ReviewedMark =>
  ({ at: now.toISOString(), fingerprint: resumeFingerprint(draft) });

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
/** A short name for an entry, such as "Analyst, Acme". Used to show where a practice question or suggestion belongs. */
export function entryLabel(entry: ResumeEntry): string {
  if (typeof entry === "string") return entry.trim().slice(0, 80);
  const role = [text(entry.position), text(entry.company)].filter(Boolean).join(", ");
  const named = role || text(entry.name) || text(entry.title) || [text(entry.degree), text(entry.institution)].filter(Boolean).join(", ") || text(entry.label);
  return (named || text(entry.bullet) || text(entry.text) || entryText(entry)).slice(0, 80);
}
