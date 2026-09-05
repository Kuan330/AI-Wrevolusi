import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  OCCUPATION_BANDS,
  type OccupationBandId,
} from "@/pages/Analysis/lib/occupationBands";

type ExposureCategoryFiltersProps = {
  counts: Record<OccupationBandId, number>;
  activeCategory: OccupationBandId | null;
  onSelect: (category: OccupationBandId | null) => void;
  totalCount?: number;
  compact?: boolean;
};

const ExposureCategoryFilters = ({
  counts,
  activeCategory,
  onSelect,
  totalCount,
  compact = false,
}: ExposureCategoryFiltersProps) => {
  return (
    <div
      className={cn(compact ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-2")}
      role="group"
      aria-label="Filter by ILO reference occupation category"
    >
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-auto justify-between rounded-xl text-left",
          compact ? "min-h-9 px-2.5 py-1.5" : "min-h-11 px-3 py-2",
          activeCategory === null
            ? "border-[#4f91ba]/45 bg-[#eaf3fb] text-[#2f5f80]"
            : "border-white/80 bg-white/60 text-[#574a55]",
        )}
        aria-pressed={activeCategory === null}
        onClick={() => onSelect(null)}
      >
          <span>
          <span className={cn("block font-semibold", compact ? "text-xs" : "text-sm")}>All tasks</span>
          {!compact ? <span className="block text-[11px] font-normal opacity-75">Show every assessed task</span> : null}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs tabular-nums">
          {totalCount ?? Object.values(counts).reduce((total, count) => total + count, 0)}
        </span>
      </Button>

      {OCCUPATION_BANDS.map((category) => {
        const selected = activeCategory === category.value;
        return (
          <Button
            key={category.value}
            type="button"
            variant="outline"
            className={cn(
              "h-auto justify-between rounded-xl text-left",
              compact ? "min-h-9 px-2.5 py-1.5" : "min-h-11 px-3 py-2",
              !selected && "border-white/80 bg-white/60 text-[#574a55]",
            )}
            style={
              selected
                ? { borderColor: "#4f91ba73", background: "#eaf3fb", color: "#2f5f80" }
                : undefined
            }
            aria-pressed={selected}
            title={category.description}
            onClick={() => onSelect(selected ? null : category.value)}
          >
            <span className="min-w-0">
              <span className={cn("block truncate font-semibold", compact ? "text-xs" : "text-sm")}>{category.label}</span>
              {!compact ? <span className="block truncate text-[11px] font-normal opacity-75">{category.description}</span> : null}
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs tabular-nums">
              {counts[category.value]}
            </span>
          </Button>
        );
      })}
    </div>
  );
};

export default ExposureCategoryFilters;
