import { useCallback, useEffect, useRef, useState } from "react";

import {
  countTaskMatchWords,
  MIN_TASK_MATCH_WORDS,
} from "@/pages/WorkProfile/taskMatchWords";
import { aiService } from "@/services/aiService";
import { referenceService } from "@/services/referenceService";
import type { ReferenceTask } from "@/types/reference";

/**
 * Automatic "closest standard task" check for the task editor.
 *
 * The match runs while the user types instead of behind a button:
 * - input below `MIN_TASK_MATCH_WORDS` meaningful words never sends a request;
 * - a short pause (debounce) triggers the existing `/ai/task-match` endpoint;
 * - in-flight requests are aborted when the input changes again, so a slow
 *   response can never overwrite newer typing;
 * - a failed request keeps the previous suggestion visible and offers a retry.
 */

export type StandardTaskMatch = {
  taskText: string;
  confidence: number;
  reason: string;
};

export type StandardTaskMatchStatus =
  | "idle"
  | "below_minimum"
  | "loading"
  | "matched"
  | "no_match"
  | "error";

const MATCH_DEBOUNCE_MS = 500;

type Options = {
  enabled: boolean;
  occupationCode?: string;
  wording: string;
};

export const useStandardTaskMatch = ({
  enabled,
  occupationCode,
  wording,
}: Options) => {
  const [status, setStatus] = useState<StandardTaskMatchStatus>("idle");
  const [match, setMatch] = useState<StandardTaskMatch | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const lastMatchRef = useRef<StandardTaskMatch | null>(null);
  const tasksRef = useRef<{ code: string; rows: ReferenceTask[] } | null>(null);

  useEffect(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;

    if (!enabled || !occupationCode) {
      setStatus("idle");
      return;
    }

    const trimmed = wording.trim();
    if (countTaskMatchWords(trimmed) < MIN_TASK_MATCH_WORDS) {
      // Back to the "keep typing" state: no request, no stale suggestion.
      setStatus("below_minimum");
      setMatch(null);
      lastMatchRef.current = null;
      return;
    }

    setStatus("loading");
    const sequence = sequenceRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          let rows =
            tasksRef.current?.code === occupationCode
              ? tasksRef.current.rows
              : null;
          if (!rows) {
            rows = await referenceService.tasks(occupationCode);
            tasksRef.current = { code: occupationCode, rows };
          }
          if (sequenceRef.current !== sequence) return;
          if (rows.length === 0) {
            setStatus("error");
            return;
          }

          const response = await aiService.taskMatch(
            {
              occupation_code: occupationCode,
              user_task: trimmed,
              candidates: rows.map((task) => ({
                id: task.task_id,
                text: task.task_text,
              })),
            },
            controller.signal,
          );
          if (sequenceRef.current !== sequence) return;

          if (response.status === "needs_more_input") {
            // Server-side double check of the same word gate.
            setStatus("below_minimum");
            setMatch(null);
            lastMatchRef.current = null;
            return;
          }

          const chosen =
            rows.find((task) => task.task_id === response.candidate_id) ?? null;
          const next = chosen
            ? {
                taskText: chosen.task_text,
                confidence: response.confidence,
                reason: response.reason,
              }
            : null;
          lastMatchRef.current = next;
          setMatch(next);
          setStatus(chosen ? "matched" : "no_match");
        } catch {
          if (sequenceRef.current !== sequence) return;
          // Keep the previous suggestion visible; offer a retry instead.
          setMatch(lastMatchRef.current);
          setStatus("error");
        }
      })();
    }, MATCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, occupationCode, wording, retryNonce]);

  const retry = useCallback(() => {
    setRetryNonce((current) => current + 1);
  }, []);

  return { status, match, retry };
};
