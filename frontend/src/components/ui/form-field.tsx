import type { ComponentProps, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const controlClass =
  "w-full rounded-xl border border-[#d9d2df] bg-white/90 px-3 py-2.5 text-sm text-[#2f2430] outline-none focus:border-[#4f91ba] focus:ring-2 focus:ring-[#4f91ba]/20 disabled:opacity-60";

export function FormField(props: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const { label, hint, children } = props;
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-semibold text-[#2f2430]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs leading-5 text-[#7f7280]">{hint}</span>
      )}
    </label>
  );
}
export function Input(props: ComponentProps<"input">) {
  const { className, ...restProps } = props;

  return <input className={cn(controlClass, className)} {...restProps} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  const { className, ...restProps } = props;

  return (
    <textarea
      className={cn(controlClass, "min-h-24 resize-y", className)}
      {...restProps}
    />
  );
}
export function NativeSelect(props: ComponentProps<"select">) {
  const { className, ...restProps } = props;

  return <select className={cn(controlClass, className)} {...restProps} />;
}

/** Fixed-choice dropdown using the shared Select and profile form styling. */
export function FormSelect(props: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  required?: boolean;
  label: string;
}) {
  const { value, onValueChange, options, placeholder, required, label } = props;
  // Radix reserves the empty string for clearing the selection.
  const emptyValue = "__unspecified__";
  const selectProps1 = {
    value: value || (options.some((option) => !option.value) ? emptyValue : ""),
    onValueChange: (next) => onValueChange(next === emptyValue ? "" : next),
    required: required,
  } satisfies Partial<ComponentProps<typeof Select>>;
  const selectTriggerProps2 = {
    "aria-label": label,
    className:
      "h-12 rounded-xl border-white/80 bg-white/95 px-4 text-sm shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10",
  } satisfies Partial<ComponentProps<typeof SelectTrigger>>;
  const selectContentProps3 = {
    sideOffset: 4,
    collisionPadding: 12,
    className:
      "z-[80] max-h-64 rounded-xl border-white/85 bg-white p-1 shadow-xl",
  } satisfies Partial<ComponentProps<typeof SelectContent>>;
  return (
    <Select {...selectProps1}>
      <SelectTrigger {...selectTriggerProps2}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent {...selectContentProps3}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            {...({
              value: option.value || emptyValue,
              className:
                "rounded-lg px-3 py-2 pr-8 text-sm focus:bg-primary/10 data-[state=checked]:bg-primary/10 data-[state=checked]:ring-1 data-[state=checked]:ring-inset data-[state=checked]:ring-primary/35",
            } satisfies Partial<ComponentProps<typeof SelectItem>>)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
