import type { ComponentProps } from "react";
import { useRef, useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";
import { Info } from "lucide-react";

/** An unfilled information trigger with hover, keyboard and touch access. */
export function InfoPopover(props: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
}) {
  const { label, children, trigger } = props;
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(value) => {
        closing.current = !value;
        setOpen(value);
      }}
    >
      <Popover.Trigger
        openOnHover
        delay={100}
        closeDelay={180}
        aria-label={label}
        onFocus={(event) => {
          if (!closing.current && event.currentTarget.matches(":focus-visible"))
            setOpen(true);
        }}
        onBlur={() => {
          closing.current = false;
        }}
        className={
          trigger
            ? "block w-full truncate border-0 bg-transparent p-0 text-left text-inherit font-inherit shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4f91ba]"
            : "ml-1 inline-flex size-6 items-center justify-center rounded-sm border-0 bg-transparent p-0 align-middle text-[#3d5f7a] shadow-none hover:text-[#4f91ba] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f91ba]"
        }
      >
        {trigger ?? (
          <Info
            {...({
              className: "size-4",
              "aria-hidden": "true",
            } satisfies Partial<ComponentProps<typeof Info>>)}
          />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-[70]"
        >
          <Popover.Popup
            initialFocus={false}
            style={{ background: PAGE_GRADIENT_CSS }}
            className="w-[min(29rem,calc(100vw-2rem))] max-h-[var(--available-height)] overflow-y-auto rounded-xl border border-[#dfd5e4] bg-[#fffafd] p-4 text-xs leading-5 text-[#574a55] shadow-xl outline-none"
          >
            <Popover.Title className="mb-2 text-sm font-semibold text-[#3d5f7a]">
              {label}
            </Popover.Title>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
