import type { ProfileTask } from "@/pages/WorkProfile/types";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "with",
  "by",
  "as",
  "such",
]);

export type TaskConflict = {
  kind: "duplicate" | "similar";
  task: ProfileTask;
};

export const normalizeTaskWording = (text: string): string =>
  text
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/[.;]+$/, "");

const contentTokens = (text: string): Set<string> => {
  const normalized = normalizeTaskWording(text);
  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens.filter((token) => token.length > 1 && !STOPWORDS.has(token)));
};

const tokenJaccard = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
};

const isSubsetTokens = (smaller: Set<string>, larger: Set<string>) =>
  smaller.size > 0 && [...smaller].every((token) => larger.has(token));

/** Mirrors backend is_kept_ilo_edit for shortened vs longer task lines. */
const isKeptEdit = (query: string, canonical: string): boolean => {
  const queryKey = normalizeTaskWording(query);
  const canonicalKey = normalizeTaskWording(canonical);
  if (!queryKey || !canonicalKey) return false;
  if (queryKey === canonicalKey) return true;
  if (queryKey.length < 20 || queryKey.length / canonicalKey.length < 0.4) return false;
  if (
    canonicalKey.startsWith(queryKey) &&
    (canonicalKey.length === queryKey.length || !/[a-z0-9]/.test(canonicalKey[queryKey.length] ?? ""))
  ) {
    return true;
  }
  const queryTokens = contentTokens(queryKey);
  const canonicalTokens = contentTokens(canonicalKey);
  if (queryTokens.size < 3) return false;
  return isSubsetTokens(queryTokens, canonicalTokens);
};

export const tasksAreDuplicate = (left: string, right: string) =>
  normalizeTaskWording(left) === normalizeTaskWording(right);

export const tasksAreHighlySimilar = (left: string, right: string): boolean => {
  if (tasksAreDuplicate(left, right)) return false;
  if (isKeptEdit(left, right) || isKeptEdit(right, left)) return true;
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  if (leftTokens.size >= 3 && rightTokens.size >= 3) {
    if (isSubsetTokens(leftTokens, rightTokens) || isSubsetTokens(rightTokens, leftTokens)) {
      return true;
    }
  }
  return tokenJaccard(leftTokens, rightTokens) >= 0.75;
};

export const findTaskConflict = (
  wording: string,
  tasks: ProfileTask[],
  excludeId?: string,
): TaskConflict | null => {
  const others = tasks.filter((task) => task.id !== excludeId);
  const duplicate = others.find((task) => tasksAreDuplicate(wording, task.wording));
  if (duplicate) return { kind: "duplicate", task: duplicate };

  const similar = others.find((task) => tasksAreHighlySimilar(wording, task.wording));
  if (similar) return { kind: "similar", task: similar };

  return null;
};

export const hasDuplicateTasks = (tasks: ProfileTask[]): boolean => {
  const seen = new Set<string>();
  for (const task of tasks) {
    const key = normalizeTaskWording(task.wording);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};
