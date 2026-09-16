import { useCallback, useEffect, useRef, useState } from "react";
import {
  composeGreeting,
  pickActionLine,
  BOT_PET_SPEECH_MS,
  type BotPetAction,
  type BotPetPage,
} from "@/components/common/botPetGreetings";

type Options = {
  /** Action-driven tip (e.g. My Plan check-in). Wins over the random greeting. */
  priority?: string | null;
  /** Wait until true before showing (e.g. plan data finished loading). */
  ready?: boolean;
  /** Skip the entry greeting (e.g. while the daily-brief tour is active). */
  skipEntry?: boolean;
};

/**
 * Entry greeting on mount, plus `say(action)` for success tips.
 * Auto-hides after 4s. Click the bubble to dismiss; click the pet for another tip.
 */
export function useBotPetGreeting(page: BotPetPage, options: Options = {}) {
  const { priority = null, ready = true, skipEntry = false } = options;
  const greetingRef = useRef<string | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const entryDone = useRef(false);

  const clearTimer = useCallback(() => {
    if (hideTimer.current !== undefined) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = undefined;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setSpeech(null);
  }, [clearTimer]);

  const showForAWhile = useCallback(
    (text: string) => {
      clearTimer();
      setSpeech(text);
      hideTimer.current = window.setTimeout(() => {
        hideTimer.current = undefined;
        setSpeech(null);
      }, BOT_PET_SPEECH_MS);
    },
    [clearTimer],
  );

  // Entry greeting — do not clear the hide timer in this effect's cleanup;
  // otherwise a later ready/skipEntry change kills the 4s timer while speech stays.
  useEffect(() => {
    if (!ready || entryDone.current || skipEntry) return;
    entryDone.current = true;
    if (!greetingRef.current) greetingRef.current = composeGreeting(page);
    const text = (priority && priority.trim()) || greetingRef.current;
    showForAWhile(text);
  }, [page, priority, ready, skipEntry, showForAWhile]);

  // Clear only when the page unmounts.
  useEffect(() => () => clearTimer(), [clearTimer]);

  const say = useCallback(
    (action: BotPetAction) => {
      showForAWhile(pickActionLine(action));
    },
    [showForAWhile],
  );

  /** Another non-flow tip (time opener + page context). */
  const nudge = useCallback(() => {
    showForAWhile(composeGreeting(page));
  }, [page, showForAWhile]);

  return { speech, say, dismiss, nudge };
}
