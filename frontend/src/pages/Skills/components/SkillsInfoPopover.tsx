import type { ComponentProps } from "react";
import { Info, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SkillsInfoPopoverProps = {
  ariaLabel: string;
  title: string;
  children: ReactNode;
  placement?: "side" | "side-start" | "below-end";
  triggerText?: string;
};

const SkillsInfoPopover = (props: SkillsInfoPopoverProps) => {
  const { ariaLabel, title, children, placement = "side", triggerText } = props;
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const infoProps1 = {
    className: "size-4",
    "aria-hidden": true,
  } satisfies Partial<ComponentProps<typeof Info>>;
  return (
    <div
      ref={rootRef}
      className={cn("skills-info", `skills-info--${placement}`)}
    >
      <button
        type="button"
        className={cn(
          "skills-info__trigger",
          triggerText && "skills-info__trigger--text",
        )}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
      >
        {triggerText ? <span>{triggerText}</span> : null}
        <Info {...infoProps1} />
      </button>

      {open ? (
        <div
          id={popoverId}
          className="skills-info__popover"
          role="dialog"
          aria-label={ariaLabel}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#2f2430]">{title}</p>
              {children}
            </div>
            <button
              type="button"
              className="skills-info__close"
              aria-label="Close explanation"
              onClick={() => setOpen(false)}
            >
              <X
                {...({
                  className: "size-4",
                  "aria-hidden": true,
                } satisfies Partial<ComponentProps<typeof X>>)}
              />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SkillsInfoPopover;
