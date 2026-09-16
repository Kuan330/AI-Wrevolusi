import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RemoveIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "variant" | "size"
> & {
  label?: string;
  icon?: ReactNode;
  /** Icon-only compact control for dense lists (tasks / skills). */
  iconOnly?: boolean;
};

/** Soft-capsule remove control. Default: icon + label; `iconOnly` for list rows. */
const RemoveIconButton = forwardRef<HTMLButtonElement, RemoveIconButtonProps>(
  (props, ref) => {
    const {
      className,
      label = "Remove",
      icon,
      iconOnly = false,
      title: _ignoredTitle,
      "aria-label": ariaLabel,
      ...rest
    } = props;

    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size={iconOnly ? "icon" : "sm"}
        aria-label={ariaLabel ?? label}
        className={cn(
          "icon-remove-btn",
          iconOnly ? "icon-remove-btn--icon-only" : "soft-btn-red",
          className,
        )}
        {...rest}
      >
        {icon ?? <Trash2 className="size-3.5" aria-hidden />}
        {iconOnly ? null : <span>{label}</span>}
      </Button>
    );
  },
);
RemoveIconButton.displayName = "RemoveIconButton";

export default RemoveIconButton;
