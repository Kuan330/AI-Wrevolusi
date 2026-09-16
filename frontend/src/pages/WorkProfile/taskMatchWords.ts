/**
 * Client-side mirror of the backend's task-matching word rule.
 *
 * The backend counts words with `count_task_text_words_for_matching` in
 * `backend/app/services/ai_matching.py`; this module applies the exact same
 * rule so the automatic task check never fires below the shared threshold and
 * the client and the server can never disagree about the count:
 *
 * - a word is a token of Unicode letters/digits, case-insensitive;
 * - tokens in the shared stop-word list are not words;
 * - duplicates still count, so repeated words add to the count;
 * - scripts without spaces (for example Chinese) count one word per run.
 *
 * Keep this stop-word list and the token pattern in sync with the backend.
 */

export const TASK_MATCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

/** Automatic matching starts once this many meaningful words are present. */
export const MIN_TASK_MATCH_WORDS = 5;

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

export const countTaskMatchWords = (value: string): number => {
  const tokens = value.toLowerCase().match(TOKEN_PATTERN) ?? [];
  return tokens.filter((token) => !TASK_MATCH_STOP_WORDS.has(token)).length;
};

export const hasMinimumTaskMatchWords = (value: string): boolean =>
  countTaskMatchWords(value) >= MIN_TASK_MATCH_WORDS;
