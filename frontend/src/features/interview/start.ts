import { readJourneyProfile } from "../journey/journey.ts";
import { accountStorage } from "../../services/accountStorage.ts";
import { CHOSEN_DIRECTION_KEY, parseChosenDirection } from "../dashboard/careerProgress.ts";
import { currentAssessments } from "../ai-impact/assistance.ts";
import { taskResearch } from "../ai-impact/taskResearch.ts";
import type { BankQuestion, ChangeTopic } from "./types.ts";
import type { prepareInterviewContext } from "./resumeItems.ts";

export type PreparedContext = ReturnType<typeof prepareInterviewContext>;
export const QUESTION_COUNT = 4;

export function futureInterviewOccupation(): { code: string; title: string } | null {
  const chosen = parseChosenDirection(accountStorage.getItem(CHOSEN_DIRECTION_KEY));
  return chosen && /^[0-9A-Za-z]{2,10}$/.test(chosen.occupationCode) && chosen.title.trim()
    ? { code: chosen.occupationCode, title: chosen.title.trim().slice(0, 200) } : null;
}

/** The target career (from Possibilities) or, if none, the user's current work. Used to pick bank questions and for learning. */
export function interviewCareer(): { code: string; title: string } | null {
  try {
    const chosen = futureInterviewOccupation();
    if (chosen) return chosen;
    const profile = readJourneyProfile();
    const code = profile.tasksOccupationCode ?? profile.analysis?.occupationCode;
    return code ? { code, title: profile.jobTitle ?? "" } : null;
  } catch { return null; }
}
/** Only current, exact research links supply an AI-impact value. */
export function availableChangeTasks(): Omit<ChangeTopic, "item_id">[] {
  try {
    const profile = readJourneyProfile();
    if (profile.analysis?.occupationCode !== profile.tasksOccupationCode) return [];
    const assessments = new Map(currentAssessments(profile).map(item => [item.task_id, item]));
    return profile.tasks.filter(task => !task.sourceOccupationCode || task.sourceOccupationCode === profile.tasksOccupationCode).flatMap(task => {
      const assessment = assessments.get(task.id), research = taskResearch(task, assessment);
      const year = Number(assessment?.source_year);
      if (research.kind !== "linked" || !assessment?.source_name?.trim() || !Number.isInteger(year) || year < 1900 || year > 2100) return [];
      const reference = research.references[0];
      return [{ id: task.id, text: task.wording.slice(0, 400), impact_score: reference.score_2025, reference_id: reference.ilo_task_id, source_name: assessment.source_name.slice(0, 160), source_year: year }];
    });
  } catch { return []; }
}

/** The user links the resume entry to its task; wording similarity is not evidence. */
export function changeTopics(context: PreparedContext, links: Record<string, string>): ChangeTopic[] {
  const tasks = new Map(availableChangeTasks().map(task => [task.id, task]));
  return context.display.filter(item => item.kind === "work").flatMap(item => {
    const task = tasks.get(links[item.id]);
    return task ? [{ ...task, id: `${item.id}:${task.id}`, text: context.redact(task.text), item_id: item.id }] : [];
  }).slice(0, 10);
}

export function planBody(context: PreparedContext, bank: BankQuestion[], topics: ChangeTopic[], reviewed: boolean) {
  return {
    role_title: context.sentRoleTitle, items: context.sent, topics, count: QUESTION_COUNT, items_reviewed: reviewed,
    bank: bank.slice(0, 12).map(question => ({ id: question.id, question: question.question })),
  };
}
