import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Radio(props: Omit<ComponentProps<"input">, "type">) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      type="radio"
      className={cn(
        "size-5 shrink-0 cursor-pointer accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    />
  );
}
