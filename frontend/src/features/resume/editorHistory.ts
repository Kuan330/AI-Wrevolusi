import type { ResumeDraft } from "./types.ts";
export type EditorSnapshot = Pick<ResumeDraft, "careerAlignment" | "document" | "yamlText" | "jobRequirements" | "gaps" | "recommendations" | "previous" | "previewDocument" | "generationInputFingerprint" | "generationOutcome" | "generationNotices" | "skillFilterVersion" | "skillFilterInputFingerprint">;
const snapshotValues = (draft: ResumeDraft): EditorSnapshot => ({ careerAlignment: draft.careerAlignment, skillFilterVersion: draft.skillFilterVersion, skillFilterInputFingerprint: draft.skillFilterInputFingerprint, generationOutcome: draft.generationOutcome, generationNotices: draft.generationNotices, generationInputFingerprint: draft.generationInputFingerprint, document: draft.document, yamlText: draft.yamlText, jobRequirements: draft.jobRequirements, gaps: draft.gaps, recommendations: draft.recommendations, previous: draft.previous, previewDocument: draft.previewDocument });
export const editorSnapshot = (draft: ResumeDraft): EditorSnapshot => structuredClone(snapshotValues(draft));
const snapshotKeys = ["document", "yamlText", "careerAlignment", "jobRequirements", "gaps", "recommendations", "previous", "previewDocument", "generationInputFingerprint", "generationOutcome", "generationNotices", "skillFilterVersion", "skillFilterInputFingerprint"] as const;
const sameSnapshot = (before: EditorSnapshot, after: EditorSnapshot) => snapshotKeys.every(key => before[key] === after[key] || (typeof before[key] === "object" && typeof after[key] === "object" && JSON.stringify(before[key]) === JSON.stringify(after[key])));
export function createEditorHistory() {
  const past: EditorSnapshot[] = [], future: EditorSnapshot[] = [];
  let current: EditorSnapshot | null = null, group: string | null = null, at = 0;
  return {
    get canUndo() { return past.length > 0; }, get canRedo() { return future.length > 0; },
    record(before: ResumeDraft, after: ResumeDraft, key: string | null = null, now = Date.now()) {
      if (sameSnapshot(snapshotValues(before), snapshotValues(after))) return;
      const sameGroup = key !== null && key === group && now - at <= 500 && !future.length;
      if (!sameGroup) { past.push(editorSnapshot(before)); if (past.length > 50) past.shift(); }
      current = editorSnapshot(after); future.length = 0; group = key; at = now;
    },
    undo(): EditorSnapshot | null {
      const previous = past.pop(); if (!previous || !current) return null;
      future.push(current); current = previous; group = null; return structuredClone(previous);
    },
    redo(): EditorSnapshot | null {
      const next = future.pop(); if (!next || !current) return null;
      past.push(current); current = next; group = null; return structuredClone(next);
    },
    sync(draft: ResumeDraft) { if (current) current = editorSnapshot(draft); },
    clear() { past.length = 0; future.length = 0; current = null; group = null; },
  };
}
