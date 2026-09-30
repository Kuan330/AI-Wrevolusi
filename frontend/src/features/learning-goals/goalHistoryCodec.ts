import type { LearningAttempt, LearningGoal } from "./learningGoals";

export const MAX_GOAL_REVISIONS = 1000;
const MAX_ATTEMPT_VERSIONS = 5000;
const fields = (v: unknown, names: string[]): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === names.length && names.every(key => Object.hasOwn(v, key));
const goalFields = ["id", "sourceKey", "createdAt", "initial", "wording", "action", "history", "revision", "needsReview", "updatedAt"];
const historyFields = ["revision", "recordedAt", "wording", "action"];
const fingerprint = (a: LearningAttempt) => JSON.stringify([a.id, a.date, a.type, a.description, a.notes, a.task ? [a.task.id, a.task.wording] : null, a.createdAt, a.updatedAt]);

/** Version 2 stores each complete attempt version once. Public readers still see full history. */
export function expandGoalState(value: unknown, validAttempt: (v: unknown) => v is LearningAttempt): unknown {
  if (!fields(value, ["version", "goals"]) || !Array.isArray(value.goals) || value.goals.length > 100) throw new Error("Invalid goals");
  if (value.version === 1) return value;
  if (value.version !== 2) throw new Error("Invalid goal version");
  const goals = value.goals.map(raw => {
    if (!fields(raw, [...goalFields, "attemptPool", "attemptRefs"]) || !Array.isArray(raw.attemptPool) || raw.attemptPool.length > MAX_ATTEMPT_VERSIONS || !raw.attemptPool.every(validAttempt) || !Array.isArray(raw.history) || raw.history.length >= MAX_GOAL_REVISIONS) throw new Error("Invalid compact goal");
    const pool = raw.attemptPool as LearningAttempt[];
    if (new Set(pool.map(fingerprint)).size !== pool.length) throw new Error("Duplicate attempt version");
    const used = new Set<number>();
    const resolve = (refs: unknown): LearningAttempt[] => {
      if (!Array.isArray(refs) || refs.length > 200 || refs.some(index => !Number.isSafeInteger(index) || index < 0 || index >= pool.length)) throw new Error("Invalid attempt reference");
      return refs.map(index => { used.add(index); return pool[index]; });
    };
    const attempts = resolve(raw.attemptRefs);
    const history = raw.history.map(item => {
      if (!fields(item, [...historyFields, "attemptRefs"])) throw new Error("Invalid compact history");
      const { attemptRefs, ...rest } = item;
      return { ...rest, attempts: resolve(attemptRefs) };
    });
    if (used.size !== pool.length) throw new Error("Unused attempt version");
    const { attemptPool: _pool, attemptRefs: _refs, ...rest } = raw;
    return { ...rest, attempts, history };
  });
  return { version: 1, goals };
}

export function compactGoalState(goals: LearningGoal[]) {
  return { version: 2, goals: goals.map(goal => {
    const attemptPool: LearningAttempt[] = [];
    const indexes = new Map<string, number>();
    const identities = new WeakMap<LearningAttempt, number>();
    function intern(attempts: LearningAttempt[]) {
      return attempts.map(attempt => {
        const known = identities.get(attempt);
        if (known !== undefined) return known;
        const key = fingerprint(attempt);
        let index = indexes.get(key);
        if (index === undefined) { index = attemptPool.length; indexes.set(key, index); attemptPool.push(attempt); }
        identities.set(attempt, index);
        return index;
      });
    }
    const { attempts, history, ...rest } = goal;
    // Earliest history first makes indices stable as the goal grows.
    const compactHistory = history.map(({ attempts: past, ...record }) => ({ ...record, attemptRefs: intern(past) }));
    const attemptRefs = intern(attempts);
    return { ...rest, attemptPool, attemptRefs, history: compactHistory };
  }) };
}
