import * as React from "react";

import { cn } from "@/lib/utils";
import { EXPOSURE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

type GradientBarSize = "sm" | "md";

type GradientBarProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
  /** `sm` is the compact table/drawer bar; `md` is the default score panel bar. */
  size?: GradientBarSize;
};

const sizeClass: Record<GradientBarSize, string> = {
  sm: "h-1.5",
  md: "h-3.5",
};

const GradientBar = React.forwardRef<HTMLDivElement, GradientBarProps>(
  (props, ref) => {
    const { value, size = "md", className, ...restProps } = props;

    const percent = Math.min(
      100,
      Math.max(0, Number.isFinite(value) ? value : 0),
    );

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-[rgba(127,114,128,0.12)]",
          sizeClass[size],
          className,
        )}
        {...restProps}
      >
        <div
          className={cn(
            "h-full min-w-0 rounded-full transition-[width] duration-300",
            size === "md" && "shadow-[0_2px_10px_rgba(79,145,186,0.28)]",
          )}
          style={{
            width: `${percent}%`,
            minWidth: percent > 0 ? (size === "sm" ? 4 : 8) : 0,
            background: EXPOSURE_GRADIENT_CSS,
          }}
        />
      </div>
    );
  },
);
GradientBar.displayName = "GradientBar";

export { GradientBar };
