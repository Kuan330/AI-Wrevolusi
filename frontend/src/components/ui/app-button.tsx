import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const toneClass = {
  brand: "soft-btn-brown profile-primary-btn",
  gradient: "soft-btn-gradient profile-gradient-btn",
  outline: "soft-btn-gray profile-outline-btn",
  blue: "soft-btn-blue profile-blue-btn",
  muted: "soft-btn-gray profile-batch-btn",
  remove: "soft-btn-red",
  accept: "soft-btn-green",
} as const;

export type AppButtonTone = keyof typeof toneClass;

export type AppButtonProps = ButtonProps & {
  tone?: AppButtonTone;
};

const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  (props, ref) => {
    const { tone = "brand", className, variant, ...restProps } = props;
    return (
      <Button
        ref={ref}
        variant={variant ?? "ghost"}
        className={cn(
          "h-10 whitespace-nowrap rounded-full px-5 shadow-none",
          toneClass[tone],
          className,
        )}
        {...restProps}
      />
    );
  },
);
AppButton.displayName = "AppButton";

export { AppButton };
