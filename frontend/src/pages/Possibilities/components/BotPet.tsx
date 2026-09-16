import { useEffect, useRef, useState, type RefObject } from "react";

import "./bot-pet.css";

type BotPetProps = {
  /** An element the pet must stay clear of, such as a sticky bottom bar. */
  avoidRef?: RefObject<HTMLElement | null>;
  /** Whether the avoid target is currently mounted. */
  avoidActive?: boolean;
};

/** Breathing room kept between the pet and whatever it is avoiding. */
const CLEARANCE = 12;

/** How long the arrival greeting waves for. */
const GREETING_MS = 2200;

/**
 * The `deepseek酱` bot companion, pinned to the bottom-right of the page.
 *
 * Frames come from `/images/bot/*_strip.webp` (6 frames, 192x208 each). The
 * `waving` strip is already ping-ponged because the source atlas only draws four
 * waving frames, so both states share the same steps(6) timing.
 *
 * The pet is purely decorative: it never takes pointer events, so it can sit on
 * top of page content without swallowing clicks. It waves in greeting on
 * arrival; to make it interactive instead, give `.px-bot__sprite`
 * `pointer-events: auto` and drive `waving` from hover handlers.
 */
export default function BotPet({
  avoidRef,
  avoidActive = false,
}: BotPetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Arrive mid-wave, then settle into the idle loop.
  const [waving, setWaving] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    timer.current = window.setTimeout(() => setWaving(false), GREETING_MS);
    return () => window.clearTimeout(timer.current);
  }, []);

  // Lift the pet only as far as the measured overlap requires, so it never
  // covers the bar and never floats higher than the layout actually needs.
  useEffect(() => {
    const root = rootRef.current;
    const avoid = avoidRef?.current;
    if (!root || !avoid || !avoidActive) {
      root?.style.setProperty("--px-bot-lift", "0px");
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const styles = window.getComputedStyle(root);
      const height =
        Number.parseFloat(styles.getPropertyValue("--px-bot-height")) ||
        root.offsetHeight;
      const base =
        Number.parseFloat(styles.getPropertyValue("--px-bot-base")) || 0;
      const bar = avoid.getBoundingClientRect();
      // Distances are measured up from the bottom edge of the viewport.
      const barTop = window.innerHeight - bar.top;
      const barBottom = window.innerHeight - bar.bottom;
      const petTop = base + height;
      const visible = bar.top < window.innerHeight && bar.bottom > 0;
      const overlaps = visible && base < barTop && petTop > barBottom;
      const lift = overlaps
        ? Math.max(0, Math.round(barTop + CLEARANCE - base))
        : 0;
      root.style.setProperty("--px-bot-lift", `${lift}px`);
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
  }, [avoidRef, avoidActive]);

  return (
    <div className="px-bot" ref={rootRef} aria-hidden="true">
      <span className={`px-bot__sprite${waving ? " is-waving" : ""}`} />
    </div>
  );
}
