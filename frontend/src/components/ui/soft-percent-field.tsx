import type { ChangeEvent, ComponentProps, KeyboardEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

import "./soft-percent-field.css";

export type SoftPercentFieldProps = {
  value: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  onValueChange: (next: string) => void;
  /** Called with the committed value (typing blur/Enter or stepper click). */
  onCommit?: (next: string) => void;
};

function clampStep(
  current: number,
  delta: number,
  min: number,
  max: number,
  step: number,
) {
  const next = Math.round((current + delta) / step) * step;
  return Math.min(max, Math.max(min, next));
}

/**
 * Soft capsule percent field: pink→blue vertical wash, custom steppers
 * (no crowded native spinner), and a trailing %.
 */
export default function SoftPercentField(props: SoftPercentFieldProps) {
  const {
    value,
    min = 0,
    max = 100,
    step = 10,
    readOnly = false,
    disabled = false,
    className,
    onValueChange,
    onCommit,
    "aria-label": ariaLabel,
  } = props;

  const parsed = Number.parseInt(value, 10);
  const numeric = Number.isFinite(parsed) ? parsed : min;
  const locked = readOnly || disabled;

  function bump(delta: number) {
    if (locked) return;
    const next = String(clampStep(numeric, delta, min, max, step));
    onValueChange(next);
    onCommit?.(next);
  }

  const inputProps = {
    className: "soft-percent-field__input",
    type: "text",
    inputMode: "numeric" as const,
    pattern: "[0-9]*",
    readOnly: locked,
    disabled,
    value,
    "aria-label": ariaLabel,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      onValueChange(event.target.value.replace(/[^\d]/g, ""));
    },
    onBlur: () => onCommit?.(value),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onCommit?.(value);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        bump(step);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        bump(-step);
      }
    },
  } satisfies ComponentProps<"input">;

  return (
    <div
      className={cn("soft-percent-field", locked && "is-locked", className)}
    >
      <input {...inputProps} />
      <span className="soft-percent-field__suffix" aria-hidden="true">
        %
      </span>
      <div className="soft-percent-field__steppers">
        <button
          type="button"
          className="soft-percent-field__step"
          aria-label="Increase"
          disabled={locked || numeric >= max}
          onClick={() => bump(step)}
        >
          <ChevronUp size={12} strokeWidth={2.4} aria-hidden />
        </button>
        <button
          type="button"
          className="soft-percent-field__step"
          aria-label="Decrease"
          disabled={locked || numeric <= min}
          onClick={() => bump(-step)}
        >
          <ChevronDown size={12} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}
