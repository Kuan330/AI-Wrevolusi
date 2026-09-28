import { localPreferences } from "@/infrastructure/storage/localPreferences";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { BOT_PET_SPEECH_MS } from "@/components/common/botPetGreetings";
import { clampPetPosition } from "./botPetPosition";

import "./bot-pet.css";

export type BotPetTour = {
  text: string;
  step: number;
  total: number;
  onNext: () => void;
  onDismiss?: () => void;
  /** Optional primary button (e.g. Check in) on the current step. */
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryBusy?: boolean;
  /** Bubble width in rem — longer steps stretch sideways, not taller. */
  widthRem?: number;
};

type BotPetProps = {
  /** An element the pet must stay clear of, such as a sticky bottom bar. */
  avoidRef?: RefObject<HTMLElement | null>;
  /** Whether the avoid target is currently mounted. */
  avoidActive?: boolean;
  /** `inline` sits in normal flow (e.g. under the calendar); default is fixed corner. */
  placement?: "fixed" | "inline";
  /** localStorage key so each page can remember its own spot. */
  storageKey?: string;
  /** Starting corner before the user drags (or when nothing is saved). */
  defaultCorner?: "bottom-right" | "top-right";
  /**
   * When set (and nothing is saved yet), place the pet at this element's
   * bottom-right instead of the viewport corner.
   */
  defaultAnchorRef?: RefObject<HTMLElement | null>;
  /** Optional cloud speech bubble shown to the left of the pet. */
  speech?: string | null;
  /** Multi-step briefing (Next / Done). Hidden while `speech` is set. */
  tour?: BotPetTour | null;
  /** Click the speech cloud to dismiss a short tip (not used for the tour). */
  onSpeechDismiss?: () => void;
  /** Tap the pet (not a drag) for another short tip. Ignored while a tour is open. */
  onPetTap?: () => void;
};

type Position = { x: number; y: number };

/** Breathing room kept between the pet and whatever it is avoiding. */
const CLEARANCE = 12;

/** How long the arrival greeting waves for. */
const GREETING_MS = 2200;

const DEFAULT_POSITION_KEY = "aiwrevolusi.botPetPosition.v1";
const GAP = 8;
const ANCHOR_INSET = 8;
const DEFAULT_W = 132;
const DEFAULT_H = 143;
/** Movement beyond this counts as a drag, not a tap. */
const TAP_SLOP = 8;

function petSize(root: HTMLElement | null): { w: number; h: number } {
  if (!root) return { w: DEFAULT_W, h: DEFAULT_H };
  const styles = window.getComputedStyle(root);
  return {
    w: root.offsetWidth || DEFAULT_W,
    h:
      Number.parseFloat(styles.getPropertyValue("--bot-pet-height")) ||
      root.offsetHeight ||
      DEFAULT_H,
  };
}

const NAVIGATION_SELECTOR = ".journey-header, .app-header, .journey-navigation";

function navigationBottom(): number {
  return Math.max(0, ...Array.from(document.querySelectorAll(NAVIGATION_SELECTOR),
    element => element.getBoundingClientRect().bottom));
}

function clamp(position: Position, root: HTMLElement | null): Position {
  const { w, h } = petSize(root);
  // Speech sits below the character's top edge. Include a taller open bubble
  // when keeping the complete companion within the lower viewport boundary.
  const speech = root?.querySelector<HTMLElement>(".bot-pet__speech");
  const height = Math.max(h, speech ? speech.offsetTop + speech.offsetHeight : 0);
  return clampPetPosition(position, {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    petWidth: w,
    petHeight: height,
    navigationBottom: navigationBottom(),
    gap: GAP,
  });
}

function cornerPosition(
  corner: "bottom-right" | "top-right",
  root: HTMLElement | null,
): Position {
  const { w, h } = petSize(root);
  const styles = root ? window.getComputedStyle(root) : null;
  const right =
    Number.parseFloat(styles?.getPropertyValue("--bot-pet-right") ?? "") || 22;
  const base =
    Number.parseFloat(styles?.getPropertyValue("--bot-pet-base") ?? "") || 18;
  if (corner === "top-right") {
    // Start below the current header and local journey navigation.
    return clamp(
      {
        x: window.innerWidth - w - right,
        y: 0,
      },
      root,
    );
  }
  return clamp(
    {
      x: window.innerWidth - w - right,
      y: window.innerHeight - h - base,
    },
    root,
  );
}

function anchorBottomRight(
  anchor: HTMLElement,
  root: HTMLElement | null,
): Position {
  const { w, h } = petSize(root);
  const box = anchor.getBoundingClientRect();
  return clamp(
    {
      x: box.right - w - ANCHOR_INSET,
      y: box.bottom - h - ANCHOR_INSET,
    },
    root,
  );
}

/**
 * The `deepseek酱` bot companion.
 *
 * Fixed placement is draggable; the last spot is remembered per `storageKey`.
 * Until the user moves it, it sits on `defaultCorner` or `defaultAnchorRef`.
 */
export default function BotPet({
  avoidRef,
  avoidActive = false,
  placement = "fixed",
  storageKey = DEFAULT_POSITION_KEY,
  defaultCorner = "bottom-right",
  defaultAnchorRef,
  speech = null,
  tour = null,
  onSpeechDismiss,
  onPetTap,
}: BotPetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [waving, setWaving] = useState(true);
  const [speechHidden, setSpeechHidden] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const isInline = placement === "inline";
  /** Measured left/top; null is only the initial CSS fallback. */
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const customised = useRef(false);
  const drag = useRef<{
    id: number;
    start: Position;
    origin: Position;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setSpeechHidden(false);
  }, [speech]);

  // Safety net: any short tip auto-hides after 4s even if the parent timer was cleared.
  useEffect(() => {
    if (!speech) return;
    const id = window.setTimeout(() => {
      setSpeechHidden(true);
      onSpeechDismiss?.();
    }, BOT_PET_SPEECH_MS);
    return () => window.clearTimeout(id);
    // Intentionally omit onSpeechDismiss — restart only when the tip text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech]);

  const setSafePosition = (next: Position) => {
    setPosition(current => current?.x === next.x && current.y === next.y ? current : next);
  };

  const applyDefault = () => {
    const root = rootRef.current;
    const anchor = defaultAnchorRef?.current;
    if (anchor) {
      setSafePosition(anchorBottomRight(anchor, root));
      return;
    }
    let next = cornerPosition(defaultCorner, root);
    const avoid = avoidRef?.current;
    if (defaultCorner === "bottom-right" && avoid && avoidActive) {
      const bar = avoid.getBoundingClientRect();
      const { h } = petSize(root);
      if (bar.top < window.innerHeight && bar.bottom > 0 && next.y < bar.bottom && next.y + h > bar.top) {
        next = clamp({ ...next, y: bar.top - h - CLEARANCE }, root);
      }
    }
    setSafePosition(next);
  };

  useEffect(() => {
    timer.current = window.setTimeout(() => setWaving(false), GREETING_MS);
    return () => window.clearTimeout(timer.current);
  }, []);

  useLayoutEffect(() => {
    if (isInline) return;
    try {
      const saved = JSON.parse(localPreferences.getItem(storageKey) ?? "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        customised.current = true;
        setSafePosition(clamp(saved, rootRef.current));
        return;
      }
    } catch {
      /* Position storage is optional. */
    }
    customised.current = false;
    applyDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore only when the placement changes
  }, [isInline, storageKey, defaultCorner, defaultAnchorRef]);

  useLayoutEffect(() => {
    if (isInline) return;
    const measure = () => {
      if (customised.current) {
        setPosition(current => {
          if (!current) return current;
          const next = clamp(current, rootRef.current);
          return next.x === current.x && next.y === current.y ? current : next;
        });
      } else {
        applyDefault();
      }
    };
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; measure(); });
    };
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    for (const element of document.querySelectorAll(NAVIGATION_SELECTOR)) observer?.observe(element);
    if (defaultAnchorRef?.current) observer?.observe(defaultAnchorRef.current);
    if (avoidRef?.current) observer?.observe(avoidRef.current);
    const bubble = rootRef.current?.querySelector(".bot-pet__speech");
    if (bubble) observer?.observe(bubble);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
    // Measurement never persists a position. Only an intentional drag does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInline, storageKey, defaultCorner, defaultAnchorRef, avoidRef, avoidActive, speech, speechHidden, tour?.text, tour?.widthRem]);

  const persist = (next: Position) => {
    try {
      localPreferences.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Keep dragging available when storage is disabled. */
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isInline || event.button !== 0) return;
    const root = event.currentTarget;
    const rect = root.getBoundingClientRect();
    const origin = position ?? { x: rect.left, y: rect.top };
    drag.current = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin,
      moved: false,
    };
    root.style.setProperty("--bot-pet-lift", "0px");
    setPosition(clamp(origin, root));
    setDragging(true);
    root.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.start.x;
    const dy = event.clientY - current.start.y;
    if (!current.moved && dx * dx + dy * dy > TAP_SLOP * TAP_SLOP) {
      current.moved = true;
    }
    if (!current.moved) return;
    setPosition(
      clamp(
        {
          x: current.origin.x + dx,
          y: current.origin.y + dy,
        },
        rootRef.current,
      ),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const wasTap = !current.moved;
    if (current.moved) {
      const next = clamp(
        {
          x: current.origin.x + event.clientX - current.start.x,
          y: current.origin.y + event.clientY - current.start.y,
        },
        rootRef.current,
      );
      customised.current = true;
      setPosition(next);
      persist(next);
    }
    drag.current = null;
    setDragging(false);
    if (wasTap && !tour) onPetTap?.();
  };

  const showTour = !speech && tour && tour.total > 0;
  const visibleSpeech = speech && !speechHidden ? speech : null;
  const dismissSpeech = () => {
    setSpeechHidden(true);
    onSpeechDismiss?.();
  };
  const lastStep = showTour && tour.step >= tour.total - 1;
  const tourLabel = showTour
    ? lastStep
      ? "Done"
      : "Next"
    : null;

  const node = (
    <div
      className={`bot-pet${isInline ? " bot-pet--inline" : ""}${!isInline && defaultCorner === "top-right" ? " bot-pet--top-right" : ""}${dragging ? " is-dragging" : ""}`}
      ref={rootRef}
      aria-hidden={isInline ? true : undefined}
      role={isInline ? undefined : "img"}
      aria-label={
        isInline
          ? undefined
          : onPetTap
            ? "Companion character. Tap for a tip, drag to move."
            : "Companion character. Drag to move."
      }
      title={
        isInline
          ? undefined
          : onPetTap
            ? "Tap for a tip · drag to move"
            : "Drag to move"
      }
      style={
        !isInline && position
          ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
          : undefined
      }
      onPointerDown={isInline ? undefined : onPointerDown}
      onPointerMove={isInline ? undefined : onPointerMove}
      onPointerUp={isInline ? undefined : endDrag}
      onPointerCancel={isInline ? undefined : endDrag}
    >
      {visibleSpeech ? (
        <p
          className="bot-pet__speech bot-pet__speech--dismissable"
          role="status"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            dismissSpeech();
          }}
        >
          {visibleSpeech}
        </p>
      ) : showTour ? (
        <div
          className="bot-pet__speech bot-pet__speech--tour"
          role="dialog"
          aria-label={`Daily briefing, step ${tour.step + 1} of ${tour.total}`}
          style={
            tour.widthRem
              ? ({
                  "--bot-speech-width": `${tour.widthRem}rem`,
                } as CSSProperties)
              : undefined
          }
          onPointerDown={(event) => event.stopPropagation()}
        >
          <p className="bot-pet__speech-text">{tour.text}</p>
          <div className="bot-pet__speech-actions">
            <span className="bot-pet__speech-meta" aria-hidden="true">
              {tour.step + 1}/{tour.total}
            </span>
            {tour.primaryLabel && tour.onPrimary ? (
              <button
                type="button"
                className="bot-pet__speech-btn bot-pet__speech-btn--primary"
                disabled={tour.primaryBusy}
                onClick={tour.onPrimary}
              >
                {tour.primaryBusy ? "…" : tour.primaryLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="bot-pet__speech-btn"
              onClick={lastStep ? (tour.onDismiss ?? tour.onNext) : tour.onNext}
            >
              {tourLabel}
            </button>
          </div>
        </div>
      ) : null}
      <span className={`bot-pet__sprite${waving ? " is-waving" : ""}`} />
    </div>
  );

  // Fixed pets portal to body so page overflow/stacking never clips them.
  if (isInline || typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
