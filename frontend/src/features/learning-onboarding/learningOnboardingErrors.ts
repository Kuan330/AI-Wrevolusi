import { ApiError } from "../../services/api.ts";

const KEEP_ANSWERS = "Your answers and resources are still here.";

/** Keep actionable save failures visible without exposing response payloads or credentials. */
export function onboardingSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return `Your account changed in another tab. ${KEEP_ANSWERS} Reload the saved account before trying again.`;
    if (error.status === 401 || error.status === 403) return `Your sign-in session could not authorise this save. ${KEEP_ANSWERS} Keep this page open and sign in again before retrying.`;
    if (error.status === 408) return `Saving your plan timed out. ${KEEP_ANSWERS} Keep this page open and try again; check your saved account before rebuilding if the connection was interrupted.`;
    if (error.status === 422) {
      if (/Workspace contains unsupported records|A saved learning choice is required/i.test(error.detail)) {
        return `The running server does not support this learning-plan setup yet. ${KEEP_ANSWERS} Update or restart the backend, then try again without refreshing this page.`;
      }
      return `The server rejected the plan (422). ${error.detail.slice(0, 500)} ${KEEP_ANSWERS} Check the message before trying again.`;
    }
    if (error.status >= 500) return `The learning-plan service is unavailable (${error.status}). ${KEEP_ANSWERS} Keep this page open and try again once the backend is running.`;
    return `Your plan could not be saved (${error.status}). ${KEEP_ANSWERS} Please try again.`;
  }
  if (error instanceof TypeError || error instanceof Error && /fetch|network|connection/i.test(error.message)) {
    return `The learning-plan server could not be reached. ${KEEP_ANSWERS} Check that the backend is running, then try again.`;
  }
  if (error instanceof Error && error.message.trim()) return `${error.message.trim().slice(0, 500)} ${KEEP_ANSWERS}`;
  return `Your plan could not be saved. ${KEEP_ANSWERS} Please try again.`;
}
