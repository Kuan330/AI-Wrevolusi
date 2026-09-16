import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import "./bot-pet.css";

type BotPetProps = {
  /** An element the pet must stay clear of, such as a sticky bottom bar. */
  avoidRef?: RefObject<HTMLElement | null>;
  /** Whether the avoid target is currently mounted. */
  avoidActive?: boolean;
  /** `inline` sits in normal flow (e.g. under the calendar); default is fixed corner. */
  placement?: "fixed" | "inline";
};

type Position = { x: number; y: number };

/** Breathing room kept between the pet and whatever it is avoiding. */
const CLEARANCE = 12;

/** How long the arrival greeting waves for. */
const GREETING_MS = 2200;

const POSITION_KEY = "aiwrevolusi.botPetPosition.v1";
const GAP = 8;
const DEFAULT_W = 132;
const DEFAULT_H = 143;

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

function clamp(position: Position, root: HTMLElement | null): Position {
  const { w, h } = petSize(root);
  return {
    x: Math.max(GAP, Math.min(position.x, window.innerWidth - w - GAP)),
    y: Math.max(GAP, Math.min(position.y, window.innerHeight - h - GAP)),
  };
}

function persist(position: Position) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  } catch {
    /* Keep dragging available when storage is disabled. */
  }
}

/**
 * The `deepseek酱` bot companion, pinned to the bottom-right of a page.
 *
 * Fixed placement is draggable; the last spot is remembered in localStorage.
 * Until the user moves it, CSS keeps the default corner so `avoidRef` lift still works.
 */
export default function BotPet({
  avoidRef,
  avoidActive = false,
  placement = "fixed",
}: BotPetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [waving, setWaving] = useState(true);
  const timer = useRef<number | undefined>(undefined);
  const isInline = placement === "inline";
  /** User-chosen left/top; null means stay on the default CSS corner. */
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    id: number;
    start: Position;
    origin: Position;
  } | null>(null);

  useEffect(() => {
    timer.current = window.setTimeout(() => setWaving(false), GREETING_MS);
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (isInline) return;
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        setPosition(clamp(saved, rootRef.current));
      }
    } catch {
      /* Position storage is optional. */
    }
  }, [isInline]);

  useEffect(() => {
    if (isInline || !position) return;
    const resize = () =>
      setPosition((current) =>
        current ? clamp(current, rootRef.current) : current,
      );
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isInline, position]);

  // Lift the pet clear of a sticky bar — only while still on the default corner.
  useEffect(() => {
    if (isInline || position) return;
    const root = rootRef.current;
    const avoid = avoidRef?.current;
    if (!root || !avoid || !avoidActive) {
      root?.style.setProperty("--bot-pet-lift", "0px");
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const styles = window.getComputedStyle(root);
      const height =
        Number.parseFloat(styles.getPropertyValue("--bot-pet-height")) ||
        root.offsetHeight;
      const base =
        Number.parseFloat(styles.getPropertyValue("--bot-pet-base")) || 0;
      const bar = avoid.getBoundingClientRect();
      const barTop = window.innerHeight - bar.top;
      const barBottom = window.innerHeight - bar.bottom;
      const petTop = base + height;
      const visible = bar.top < window.innerHeight && bar.bottom > 0;
      const overlaps = visible && base < barTop && petTop > barBottom;
      const lift = overlaps
        ? Math.max(0, Math.round(barTop + CLEARANCE - base))
        : 0;
      root.style.setProperty("--bot-pet-lift", `${lift}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(avoid);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [avoidRef, avoidActive, isInline, position]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isInline || event.button !== 0) return;
    const root = event.currentTarget;
    const rect = root.getBoundingClientRect();
    const origin = position ?? { x: rect.left, y: rect.top };
    drag.current = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin,
    };
    root.style.setProperty("--bot-pet-lift", "0px");
    setPosition(clamp(origin, root));
    setDragging(true);
    root.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    setPosition(
      clamp(
        {
          x: current.origin.x + event.clientX - current.start.x,
          y: current.origin.y + event.clientY - current.start.y,
        },
        rootRef.current,
      ),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const next = clamp(
      {
        x: current.origin.x + event.clientX - current.start.x,
        y: current.origin.y + event.clientY - current.start.y,
      },
      rootRef.current,
    );
    setPosition(next);
    persist(next);
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      className={`bot-pet${isInline ? " bot-pet--inline" : ""}${dragging ? " is-dragging" : ""}`}
      ref={rootRef}
      aria-hidden={isInline ? true : undefined}
      role={isInline ? undefined : "img"}
      aria-label={isInline ? undefined : "Companion character. Drag to move."}
      title={isInline ? undefined : "Drag to move"}
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
      <span className={`bot-pet__sprite${waving ? " is-waving" : ""}`} />
    </div>
  );
}
