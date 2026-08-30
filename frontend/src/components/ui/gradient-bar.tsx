import * as React from "react"

import { cn } from "@/lib/utils"
import { EXPOSURE_GRADIENT_CSS } from "@/pages/Dashboard/lib/palette"

type GradientBarProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number
}

const GradientBar = React.forwardRef<HTMLDivElement, GradientBarProps>(
  ({ value, className, ...props }, ref) => {
    const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className={cn(
          "relative h-3.5 w-full overflow-hidden rounded-full bg-[rgba(127,114,128,0.12)]",
          className,
        )}
        {...props}
      >
        <div
          className="h-full min-w-0 rounded-full shadow-[0_2px_10px_rgba(79,145,186,0.28)] transition-[width] duration-300"
          style={{
            width: `${percent}%`,
            minWidth: percent > 0 ? 8 : 0,
            background: EXPOSURE_GRADIENT_CSS,
          }}
        />
      </div>
    )
  },
)
GradientBar.displayName = "GradientBar"

export { GradientBar }
