import type { ComponentProps } from "react";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>((props, ref) => {
  const { className, ...restProps } = props;
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-[#2f2430]/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...restProps}
    />
  );
});
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>((props, ref) => {
  const { className, children, ...restProps } = props;
  return (
    <DialogPrimitive.Portal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xl flex-col gap-4 border-l border-white/80 bg-[#fffafe]/95 p-6 text-[#2f2430] shadow-[-16px_0_40px_rgba(61,43,54,0.16)] backdrop-blur-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:p-8",
          className,
        )}
        {...restProps}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-5 top-5 rounded-full border border-[#d8e8f3] bg-white/80 p-2 text-[#7f7280] transition-colors hover:bg-[#d6eaf7] hover:text-[#2f5f80] focus:outline-none focus:ring-2 focus:ring-[#9ec9e4]">
          <X
            {...({
              className: "size-4",
              "aria-hidden": "true",
            } satisfies Partial<ComponentProps<typeof X>>)}
          />
          <span className="sr-only">Close details</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DrawerContent.displayName = DialogPrimitive.Content.displayName;

const DrawerHeader = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const { className, ...restProps } = props;
  return (
    <div
      className={cn("flex flex-col space-y-2 pr-10", className)}
      {...restProps}
    />
  );
};
DrawerHeader.displayName = "DrawerHeader";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>((props, ref) => {
  const { className, ...restProps } = props;
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-xl font-semibold leading-snug", className)}
      {...restProps}
    />
  );
});
DrawerTitle.displayName = DialogPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>((props, ref) => {
  const { className, ...restProps } = props;
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm leading-6 text-[#7f7280]", className)}
      {...restProps}
    />
  );
});
DrawerDescription.displayName = DialogPrimitive.Description.displayName;

const DrawerBody = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const { className, ...restProps } = props;
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto pr-1", className)}
      {...restProps}
    />
  );
};
DrawerBody.displayName = "DrawerBody";

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger,
};
