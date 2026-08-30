import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const toneClass = {
  brand: "profile-primary-btn",
  gradient: "profile-gradient-btn",
  outline: "profile-outline-btn",
  blue: "profile-blue-btn",
  muted: "profile-batch-btn",
} as const

export type AppButtonTone = keyof typeof toneClass

export type AppButtonProps = ButtonProps & {
  tone?: AppButtonTone
}

const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ tone = "brand", className, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn("h-10 whitespace-nowrap rounded-full px-5", toneClass[tone], className)}
      {...props}
    />
  ),
)
AppButton.displayName = "AppButton"

export { AppButton }
