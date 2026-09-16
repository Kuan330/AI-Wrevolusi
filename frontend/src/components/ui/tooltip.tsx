import type { ReactElement, ReactNode } from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

export type TooltipProps = {
  title: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
};

/** Lightweight hover/focus hint. Usage: `<Tooltip title="Edit"><button /></Tooltip>`. */
export function Tooltip(props: TooltipProps) {
  const { title, children, side = "top", className } = props;

  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          delay={160}
          closeDelay={80}
          className={cn(className)}
          render={children}
        />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={6} className="z-[80]">
            <BaseTooltip.Popup className="max-w-[16rem] rounded-lg border border-[#dfd5e4] bg-[#2f2430] px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg outline-none">
              {title}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}

export default Tooltip;
