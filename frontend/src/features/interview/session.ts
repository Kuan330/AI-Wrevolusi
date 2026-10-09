import type { Feedback, InterviewItem, PlanResult, QuestionKind } from "./types.ts";

export type FollowUp = { id: string; text: string; answer: string | null; skipped: boolean; correction: string };
export type Attempt = { id: string; answer: string; mode: "text" | "voice"; submittedAt: string; feedback: Feedback | null; error: string; followUps: FollowUp[] };
/** `text` is what the user reads. `sentText` is the redacted wording AI wrote, used when asking for feedback. */
export type SessionQuestion = { id: string; text: string; sentText: string; kind: QuestionKind; itemId: string | null; itemLabel: string | null; skipped: boolean; attempts: Attempt[]; draft?: string };
/** The reviewed resume this session used. Later edits in the resume do not change it. */
export type ResumeVersion = { reviewedAt: string; itemCount: number };
export type InterviewSession = {
  version: 1; id: string; createdAt: string; updatedAt: string; mode: "resume" | "general"; source: "ai" | "template";
  role: { title: string; requirements: string }; resumeVersion: ResumeVersion | null; items: InterviewItem[]; questions: SessionQuestion[];
};
export const MAX_FOLLOW_UPS = 2;
export const MAX_SESSIONS = 20;
const newId = () => globalThis.crypto.randomUUID();
const stamp = (now?: Date) => (now ?? new Date()).toISOString();

export function createSession(input: {
  mode: InterviewSession["mode"]; role: InterviewSession["role"]; resumeVersion: ResumeVersion | null; items: InterviewItem[];
  plan: PlanResult; restore?: (value: string) => string; now?: Date;
}): InterviewSession {
  const restore = input.restore ?? (value => value), byId = new Map(input.items.map(item => [item.id, item]));
  const questions = input.plan.questions.map(question => ({
    id: newId(), text: restore(question.text), sentText: question.text, kind: question.kind, itemId: question.item_id && byId.has(question.item_id) ? question.item_id : null,
    itemLabel: question.item_id ? byId.get(question.item_id)?.label ?? null : null, skipped: false, attempts: [] as Attempt[],
  }));
  if (!questions.length) throw new Error("No practice questions are available yet. Try again.");
  const at = stamp(input.now);
  return { version: 1, id: newId(), createdAt: at, updatedAt: at, mode: input.mode, source: input.plan.source, role: input.role, resumeVersion: input.resumeVersion, items: input.items, questions };
}

const change = (session: InterviewSession, questionId: string, update: (question: SessionQuestion) => SessionQuestion): InterviewSession => {
  if (!session.questions.some(question => question.id === questionId)) throw new Error("This question is no longer in the session.");
  return { ...session, updatedAt: stamp(), questions: session.questions.map(question => question.id === questionId ? update(question) : question) };
};
const changeAttempt = (session: InterviewSession, questionId: string, attemptId: string, update: (attempt: Attempt) => Attempt) =>
  change(session, questionId, question => {
    if (!question.attempts.some(attempt => attempt.id === attemptId)) throw new Error("This answer is no longer in the session.");
    return { ...question, attempts: question.attempts.map(attempt => attempt.id === attemptId ? update(attempt) : attempt) };
  });

export const followUpCount = (question: SessionQuestion) => question.attempts.reduce((total, attempt) => total + attempt.followUps.length, 0);

export function addAttempt(session: InterviewSession, questionId: string, input: { answer: string; mode: Attempt["mode"] }): { session: InterviewSession; attemptId: string } {
  const answer = input.answer.trim();
  if (!answer) throw new Error("Add your answer first.");
  const attempt: Attempt = { id: newId(), answer, mode: input.mode, submittedAt: stamp(), feedback: null, error: "", followUps: [] };
  return { attemptId: attempt.id, session: change(session, questionId, question => ({ ...question, skipped: false, attempts: [...question.attempts, attempt], draft: "" })) };
}
export const setAttemptError = (session: InterviewSession, questionId: string, attemptId: string, error: string) =>
  changeAttempt(session, questionId, attemptId, attempt => ({ ...attempt, error }));

/** Store feedback. A follow-up question is kept only while the question has fewer than two. */
export function setAttemptFeedback(session: InterviewSession, questionId: string, attemptId: string, feedback: Feedback): InterviewSession {
  const question = session.questions.find(item => item.id === questionId);
  const room = question ? followUpCount(question) < MAX_FOLLOW_UPS : false;
  const text = feedback.follow_up?.trim();
  return changeAttempt(session, questionId, attemptId, attempt => ({
    ...attempt, feedback, error: "", followUps: text && room ? [...attempt.followUps, { id: newId(), text, answer: null, skipped: false, correction: "" }] : attempt.followUps,
  }));
}
export const answerFollowUp = (session: InterviewSession, questionId: string, attemptId: string, followUpId: string, reply: { answer?: string; skipped?: boolean; correction?: string }) =>
  changeAttempt(session, questionId, attemptId, attempt => ({
    ...attempt, followUps: attempt.followUps.map(item => item.id !== followUpId ? item : {
      ...item, answer: reply.answer !== undefined ? reply.answer.trim() || null : item.answer, skipped: reply.skipped ?? item.skipped, correction: reply.correction ?? item.correction,
    }),
  }));
/** Keep an unsent text answer so it survives leaving the page. */
export const setDraft = (session: InterviewSession, questionId: string, draft: string) => change(session, questionId, question => ({ ...question, draft: draft.slice(0, 4000) }));
export const skipQuestion = (session: InterviewSession, questionId: string) => change(session, questionId, question => ({ ...question, skipped: true }));
export const reopenQuestion = (session: InterviewSession, questionId: string) => change(session, questionId, question => ({ ...question, skipped: false }));

export const questionDone = (question: SessionQuestion) => question.skipped || question.attempts.some(attempt => attempt.feedback !== null);
export function sessionProgress(session: InterviewSession) {
  const total = session.questions.length, skipped = session.questions.filter(question => question.skipped).length;
  const answered = session.questions.filter(question => !question.skipped && question.attempts.some(attempt => attempt.feedback)).length;
  return { total, answered, skipped, remaining: total - answered - skipped, complete: answered + skipped === total };
}
export const nextOpenQuestion = (session: InterviewSession, from = -1): number => {
  const order = [...session.questions.keys()];
  return [...order.slice(from + 1), ...order.slice(0, from + 1)].find(index => !questionDone(session.questions[index])) ?? -1;
};

const RANK = { no: 0, partly: 1, yes: 2 } as const;
export type CheckChange = { id: Feedback["checks"][number]["id"]; before: Feedback["checks"][number]["status"]; after: Feedback["checks"][number]["status"]; result: "better" | "same" | "worse" };
/** Compare two feedback results by check. This shows what was addressed. It is not a score of competence. */
export function compareAttempts(before: Attempt, after: Attempt): { changes: CheckChange[]; addressed: CheckChange[]; stillOpen: CheckChange[] } | null {
  if (!before.feedback || !after.feedback) return null;
  const old = new Map(before.feedback.checks.map(check => [check.id, check.status]));
  const changes = after.feedback.checks.flatMap(check => {
    const prior = old.get(check.id);
    if (!prior || prior === "not_applicable" || check.status === "not_applicable") return [];
    const result: CheckChange["result"] = RANK[check.status] > RANK[prior] ? "better" : RANK[check.status] < RANK[prior] ? "worse" : "same";
    return [{ id: check.id, before: prior, after: check.status, result }];
  });
  return { changes, addressed: changes.filter(item => item.result === "better"), stillOpen: changes.filter(item => item.after !== "yes") };
}

export function upsertSession(sessions: InterviewSession[], session: InterviewSession): InterviewSession[] {
  return [session, ...sessions.filter(item => item.id !== session.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_SESSIONS);
}
