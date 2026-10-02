import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import Tooltip from "@/components/ui/tooltip";

/** Hover/focus for a hint; click pins it until dismissed. */
export default function InfoHint({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!pinned) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) { setPinned(false); setOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setPinned(false); setOpen(false); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [pinned]);
  return <span ref={ref} className="px-hint"><Tooltip title={text} open={open} onOpenChange={value => { if (!pinned) setOpen(value); }}><button type="button" aria-label={label} aria-pressed={pinned} onClick={() => { setPinned(!pinned); setOpen(!pinned); }}><Info size={16} aria-hidden="true" /></button></Tooltip></span>;
}
