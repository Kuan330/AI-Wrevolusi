import { useEffect, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

type Position = { x: number; y: number };
type Props = { count: number; onOpen: () => void };
const KEY = "aiwrevolusi.savedCoursesPosition.v1";
const SIZE = 56;
const GAP = 16;
function clamp(position: Position): Position {
  return {
    x: Math.max(GAP, Math.min(position.x, window.innerWidth - SIZE - GAP)),
    y: Math.max(GAP, Math.min(position.y, window.innerHeight - SIZE - GAP)),
  };
}
function initialPosition(): Position {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y))
      return clamp(saved);
  } catch {
    /* Position storage is optional. */
  }
  return clamp({
    x: window.innerWidth - SIZE - GAP,
    y: window.innerHeight * 0.55,
  });
}
function persist(position: Position) {
  try {
    localStorage.setItem(KEY, JSON.stringify(position));
  } catch {
    /* Keep dragging available when storage is disabled. */
  }
}
export default function FloatingSavedCourses(props: Props) {
  const { count, onOpen } = props;
  const [position, setPosition] = useState(initialPosition);
  const drag = useRef<{
    id: number;
    start: Position;
    origin: Position;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const resize = () => setPosition((current) => clamp(current));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return (
    <Button
      className="floating-saved-courses"
      style={{ left: position.x, top: position.y }}
      aria-label={`Saved courses · ${count}. Drag to move, or use arrow keys to reposition.`}
      title={`Saved courses · ${count} — drag to move`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        drag.current = {
          id: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          origin: position,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.start.x;
        const dy = event.clientY - current.start.y;
        if (Math.hypot(dx, dy) > 5) current.moved = true;
        if (current.moved)
          setPosition(
            clamp({ x: current.origin.x + dx, y: current.origin.y + dy }),
          );
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        suppressClick.current = current.moved;
        if (current.moved)
          persist(
            clamp({
              x: current.origin.x + event.clientX - current.start.x,
              y: current.origin.y + event.clientY - current.start.y,
            }),
          );
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
        suppressClick.current = true;
      }}
      onClick={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          suppressClick.current = false;
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        const offsets: Record<string, Position> = {
          ArrowLeft: { x: -16, y: 0 },
          ArrowRight: { x: 16, y: 0 },
          ArrowUp: { x: 0, y: -16 },
          ArrowDown: { x: 0, y: 16 },
        };
        const offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault();
        const next = clamp({
          x: position.x + offset.x,
          y: position.y + offset.y,
        });
        setPosition(next);
        persist(next);
      }}
    >
      <Bookmark size={24} aria-hidden="true" />
      {count > 0 && (
        <span className="floating-saved-count" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
