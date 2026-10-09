import { interviewStore } from "../../infrastructure/storage/interviewStore.ts";
import { MAX_SESSIONS, upsertSession, type InterviewSession } from "./session.ts";

export type InterviewRecord = { version: 1; owner: string; revision: number; sessions: InterviewSession[] };
const mapping = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown) => typeof value === "string";
const validAttempt = (value: unknown) => mapping(value) && text(value.id) && text(value.answer) && text(value.submittedAt) && text(value.error) &&
  Array.isArray(value.followUps) && value.followUps.every(item => mapping(item) && text(item.id) && text(item.text) && text(item.correction));
const validQuestion = (value: unknown) => mapping(value) && text(value.id) && text(value.text) && text(value.sentText) && text(value.kind) && typeof value.skipped === "boolean" &&
  Array.isArray(value.attempts) && value.attempts.every(validAttempt);
const validSession = (value: unknown) => mapping(value) && value.version === 1 && text(value.id) && text(value.createdAt) && text(value.updatedAt) &&
  (value.mode === "resume" || value.mode === "general") && mapping(value.role) && text(value.role.title) && text(value.role.requirements) &&
  Array.isArray(value.items) && Array.isArray(value.questions) && value.questions.every(validQuestion);

export function parseInterviewRecord(raw: unknown, owner: string): InterviewRecord {
  if (raw === null || raw === undefined) return { version: 1, owner, revision: 0, sessions: [] };
  if (!mapping(raw) || raw.version !== 1 || raw.owner !== owner || !Number.isSafeInteger(raw.revision) || !Array.isArray(raw.sessions) ||
      raw.sessions.length > MAX_SESSIONS || !raw.sessions.every(validSession)) {
    throw new Error("Your saved practice could not be read. It has not been overwritten. Delete saved practice only if you want to start again.");
  }
  return raw as InterviewRecord;
}
export const loadInterview = async (owner: string) => parseInterviewRecord(await interviewStore.read(owner), owner);
/** Replace one session. The revision check stops an old tab from overwriting newer practice. */
export const saveInterviewSession = (owner: string, session: InterviewSession, revision: number, isCurrent: () => boolean = () => true) =>
  interviewStore.update(owner, raw => {
    if (!isCurrent()) throw new Error("Your account changed. This practice was not saved into another account.");
    const current = parseInterviewRecord(raw, owner);
    if (current.revision !== revision) throw new Error("Another tab changed your practice. Reload before continuing; this tab has not overwritten it.");
    return { version: 1 as const, owner, revision: revision + 1, sessions: upsertSession(current.sessions, session) };
  });
export const deleteInterviewSession = (owner: string, id: string, revision: number) =>
  interviewStore.update(owner, raw => {
    const current = parseInterviewRecord(raw, owner);
    if (current.revision !== revision) throw new Error("Another tab changed your practice. Reload before deleting.");
    return { version: 1 as const, owner, revision: revision + 1, sessions: current.sessions.filter(session => session.id !== id) };
  });
export const clearInterview = (owner: string) => interviewStore.clear(owner);
