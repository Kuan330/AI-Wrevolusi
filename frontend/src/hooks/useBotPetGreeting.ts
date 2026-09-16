import { useCallback, useEffect, useRef, useState } from "react";
import {
  composeGreeting,
  pickActionLine,
  type BotPetAction,
  type BotPetPage,
} from "@/components/common/botPetGreetings";

/** How long the bubble stays visible. */
const SHOW_MS = 4000;

type Options = {
  /** Action-driven tip (e.g. My Plan check-in). Wins over the random greeting. */
  priority?: string | null;
  /** Wait until true before showing (e.g. plan data finished loading). */
  ready?: boolean;
  /** Skip the entry greeting (e.g. My Plan uses the daily-brief panel instead). */
  skipEntry?: boolean;
};

/**
 * Entry greeting on mount, plus `say(action)` for success tips.
 * Auto-hides after ~4s, or on first scroll / pointer down.
 */
export function useBotPetGreeting(page: BotPetPage, options: Options = {}) {
  const { priority = null, ready = true, skipEntry = false } = options;
  const greetingRef = useRef<string | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const entryDone = useRef(false);

  const clearHideListeners = useRef<(() => void) | null>(null);

  const showForAWhile = useCallback((text: string) => {
    clearHideListeners.current?.();
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setSpeech(text);
    const hide = () => setSpeech(null);
    hideTimer.current = window.setTimeout(hide, SHOW_MS);
    window.addEventListener("scroll", hide, { once: true, capture: true });
    window.addEventListener("pointerdown", hide, { once: true });
    clearHideListeners.current = () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("pointerdown", hide);
    };
  }, []);

  useEffect(() => {
    if (!ready || entryDone.current || skipEntry) return;
    entryDone.current = true;
    if (!greetingRef.current) greetingRef.current = composeGreeting(page);
    const text = (priority && priority.trim()) || greetingRef.current;
    showForAWhile(text);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      clearHideListeners.current?.();
    };
  }, [page, priority, ready, skipEntry, showForAWhile]);

  const say = useCallback(
    (action: BotPetAction) => {
      showForAWhile(pickActionLine(action));
    },
    [showForAWhile],
  );

  return { speech, say };
}
