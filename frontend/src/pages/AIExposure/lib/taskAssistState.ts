export const DEFAULT_TASK_ASSIST_QUESTION =
  "How can AI assist me in completing this task?";

export const taskAssistResponseLabel = (generatedByModel: boolean) =>
  generatedByModel
    ? "Model response"
    : "Fallback guidance — the AI model was unavailable.";

export const taskAssistContextKey = (
  taskId: string,
  wording: string,
  notes: string,
) => JSON.stringify([taskId, wording, notes]);

export const shouldApplyTaskAssistResult = (
  requestId: number,
  activeRequestId: number,
  dialogOpen: boolean,
  requestTaskId: string,
  activeTaskId: string | null,
) =>
  dialogOpen &&
  requestId === activeRequestId &&
  requestTaskId === activeTaskId;
