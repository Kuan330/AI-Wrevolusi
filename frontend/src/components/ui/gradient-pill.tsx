import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { PAGE_GRADIENT_CSS, Palette } from "@/pages/Dashboard/lib/palette"

const gradientPillVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold shadow-sm",
  {
    variants: {
      size: {
        default: "h-8 px-3.5 text-xs",
        sm: "px-3 py-1 text-[11px] leading-snug",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
)

export type GradientPillProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof gradientPillVariants> & {
    asChild?: boolean
  }

const GradientPill = React.forwardRef<HTMLElement, GradientPillProps>(
  ({ asChild = false, className, size, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "span"

    return (
      <Comp
        ref={ref}
        className={cn(gradientPillVariants({ size }), className)}
        style={{
          background: PAGE_GRADIENT_CSS,
          color: Palette.Ink,
          ...style,
        }}
        {...props}
      />
    )
  },
)
GradientPill.displayName = "GradientPill"

export { GradientPill, gradientPillVariants }
