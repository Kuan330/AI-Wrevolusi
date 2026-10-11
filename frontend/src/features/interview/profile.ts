import { COMPETENCIES } from "./competencies.ts";
import type { InterviewSession } from "./session.ts";
import type { CompetencyId, CompetencyScore, Level } from "./types.ts";

export type Evidence = CompetencyScore & { at: string; sessionId: string; questionId: string; question: string };
/** `none` no answer yet, `first_look` one answer, `early` two or three, `steady` four or more. */
export type Confidence = "none" | "first_look" | "early" | "steady";
export type SkillRow = {
  id: CompetencyId; label: string; hint: string; evidence: Evidence[]; mean: number | null; level: Level | null; confidence: Confidence;
  trend: "up" | "down" | "steady" | null;
};
export type Profile = {
  answers: number; rows: SkillRow[]; strengths: SkillRow[]; improve: SkillRow[]; notYet: SkillRow[];
  gaps: { skillId: number; count: number; reason: string }[];
};

const clamp = (value: number): Level => Math.min(4, Math.max(1, Math.round(value))) as Level;
const average = (items: Evidence[]) => items.reduce((total, item) => total + item.level, 0) / items.length;

/** The last answer that got feedback for each question. Earlier tries are practice, not evidence. */
function latestScored(session: InterviewSession) {
  return session.questions.flatMap(question => {
    if (question.skipped) return [];
    const attempt = [...question.attempts].reverse().find(entry => entry.feedback);
    return attempt?.feedback ? [{ session, question, attempt, feedback: attempt.feedback }] : [];
  });
}

/**
 * Turn saved answers into a per-skill overview. A level is the rounded average of what each answer showed.
 * It only describes practice answers so far. With one answer it is a first look, not a finding.
 */
export function buildProfile(sessions: InterviewSession[]): Profile {
  const evidence = new Map<CompetencyId, Evidence[]>(), gaps = new Map<number, { count: number; reason: string }>();
  let answers = 0;
  for (const { session, question, attempt, feedback } of sessions.flatMap(latestScored)) {
    answers += 1;
    for (const score of feedback.scores ?? []) {
      evidence.set(score.competency, [...evidence.get(score.competency) ?? [], { ...score, at: attempt.submittedAt, sessionId: session.id, questionId: question.id, question: question.text }]);
    }
    if (feedback.skill_gap) {
      const old = gaps.get(feedback.skill_gap.skill_id);
      gaps.set(feedback.skill_gap.skill_id, { count: (old?.count ?? 0) + 1, reason: feedback.skill_gap.reason });
    }
  }
  const rows = COMPETENCIES.map(({ id, label, hint }): SkillRow => {
    const items = (evidence.get(id) ?? []).sort((a, b) => a.at.localeCompare(b.at));
    const mean = items.length ? average(items) : null;
    const half = Math.floor(items.length / 2);
    const change = items.length >= 4 ? average(items.slice(half)) - average(items.slice(0, half)) : null;
    return {
      id, label, hint, evidence: items, mean, level: mean === null ? null : clamp(mean),
      confidence: items.length === 0 ? "none" : items.length === 1 ? "first_look" : items.length < 4 ? "early" : "steady",
      trend: change === null ? null : change >= 0.5 ? "up" : change <= -0.5 ? "down" : "steady",
    };
  });
  const scored = rows.filter(row => row.level !== null);
  return {
    answers, rows,
    strengths: scored.filter(row => row.level! >= 3).sort((a, b) => b.mean! - a.mean!),
    improve: scored.filter(row => row.level! < 3).sort((a, b) => a.mean! - b.mean! || b.evidence.length - a.evidence.length),
    notYet: rows.filter(row => row.level === null),
    gaps: [...gaps].map(([skillId, value]) => ({ skillId, ...value })).sort((a, b) => b.count - a.count),
  };
}

/** The lowest scoring answers for a skill, so the user can see the words behind the level. */
export const weakestEvidence = (row: SkillRow, limit = 2) => [...row.evidence].sort((a, b) => a.level - b.level || b.at.localeCompare(a.at)).slice(0, limit);

export type ScoreChange = { competency: CompetencyId; before: Level; after: Level };
/** Compare what two tries at the same question showed. Only skills scored in both tries are compared. */
export function compareScores(before: CompetencyScore[] | undefined, after: CompetencyScore[] | undefined): ScoreChange[] {
  const old = new Map((before ?? []).map(score => [score.competency, score.level]));
  return (after ?? []).flatMap(score => old.has(score.competency) ? [{ competency: score.competency, before: old.get(score.competency)!, after: score.level }] : []);
}
