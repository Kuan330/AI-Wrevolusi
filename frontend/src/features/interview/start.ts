import { readJourneyProfile } from "../journey/journey.ts";
import { accountStorage } from "../../services/accountStorage.ts";
import { CHOSEN_DIRECTION_KEY, parseChosenDirection } from "../dashboard/careerProgress.ts";
import type { BankQuestion } from "./types.ts";
import type { prepareInterviewContext } from "./resumeItems.ts";

export type PreparedContext = ReturnType<typeof prepareInterviewContext>;
export const QUESTION_COUNT = 4;

/** The target career (from Possibilities) or, if none, the user's current work. Used to pick bank questions and for learning. */
export function interviewCareer(): { code: string; title: string } | null {
  try {
    const chosen = parseChosenDirection(accountStorage.getItem(CHOSEN_DIRECTION_KEY));
    if (chosen) return { code: chosen.occupationCode, title: chosen.title };
    const profile = readJourneyProfile();
    const code = profile.tasksOccupationCode ?? profile.analysis?.occupationCode;
    return code ? { code, title: profile.jobTitle ?? "" } : null;
  } catch { return null; }
}
/** Confirmed work tasks are offered as AI-change topics. A question about one never assumes the user uses AI. */
export function changeTopics(redact: (text: string) => string): { id: string; text: string }[] {
  try {
    const profile = readJourneyProfile();
    return profile.tasksConfirmed ? profile.tasks.slice(0, 6).map(task => ({ id: task.id, text: redact(task.wording).slice(0, 400) })) : [];
  } catch { return []; }
}
export function planBody(context: PreparedContext, bank: BankQuestion[], topics: { id: string; text: string }[], reviewed: boolean) {
  return {
    role_title: context.sentRoleTitle, items: context.sent, topics, count: QUESTION_COUNT, items_reviewed: reviewed,
    bank: bank.slice(0, 12).map(question => ({ id: question.id, question: question.question })),
  };
}
