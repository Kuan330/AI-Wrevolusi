import type { ResumeDraft } from "./types.ts";
export type EditorSnapshot = Pick<ResumeDraft, "document" | "yamlText" | "jobRequirements" | "pendingJobRequirements" | "gaps" | "recommendations" | "previous" | "previewDocument">;
export const editorSnapshot = (draft: ResumeDraft): EditorSnapshot => structuredClone({ document: draft.document, yamlText: draft.yamlText, jobRequirements: draft.jobRequirements, pendingJobRequirements: draft.pendingJobRequirements, gaps: draft.gaps, recommendations: draft.recommendations, previous: draft.previous, previewDocument: draft.previewDocument });
export function createEditorHistory() {
  const past: EditorSnapshot[] = [], future: EditorSnapshot[] = [];
  let current: EditorSnapshot | null = null, group: string | null = null, at = 0;
  return {
    get canUndo() { return past.length > 0; }, get canRedo() { return future.length > 0; },
    record(before: ResumeDraft, after: ResumeDraft, key: string | null = null, now = Date.now()) {
      if (JSON.stringify(editorSnapshot(before)) === JSON.stringify(editorSnapshot(after))) return;
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
