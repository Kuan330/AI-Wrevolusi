import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type FilterableSelectOption = {
  value: string;
  label: string;
};

interface FilterableSelectProps {
  value: string;
  placeholder: string;
  options: FilterableSelectOption[];
  disabled?: boolean;
  showSearchIcon?: boolean;
  emptyMessage?: string;
  onValueChange: (value: string) => void;
}

const FilterableSelect = ({
  value,
  placeholder,
  options,
  disabled = false,
  showSearchIcon = true,
  emptyMessage = "No matching options.",
  onValueChange,
}: FilterableSelectProps) => {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [selected]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <div className="relative">
      {showSearchIcon ? (
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      ) : null}
      <input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setQuery(selected?.label ?? "");
          }, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        className={cn(
          "h-12 w-full rounded-xl border border-white/80 bg-white/95 pr-20 text-sm outline-none shadow-sm transition",
          showSearchIcon ? "pl-10" : "pl-4",
          "focus:border-primary focus:ring-4 focus:ring-primary/10",
          "disabled:cursor-not-allowed disabled:bg-white/70 disabled:text-muted-foreground",
        )}
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <ChevronDown className="h-4 w-4" />
      </div>
      {value ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onValueChange("");
            setQuery("");
            setOpen(true);
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Clear selected option"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-white/85 bg-white p-2 shadow-xl">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onValueChange(option.value);
                  setQuery(option.label);
                  setOpen(false);
                }}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                  value === option.value
                    ? "bg-primary/10 text-foreground ring-1 ring-primary/35"
                    : "text-foreground hover:bg-muted/60",
                )}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export default FilterableSelect;
