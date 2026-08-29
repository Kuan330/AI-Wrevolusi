import { OCCUPATION_FILTERS, type OccupationFilterKey } from "@/pages/WorkProfile/occupationFilters";
import type { ReferenceOccupation } from "@/types/reference";

type OccupationFiltersProps = {
  options: Record<OccupationFilterKey, ReferenceOccupation[]>;
  selections: Record<OccupationFilterKey, ReferenceOccupation | null>;
  onSelect: (key: OccupationFilterKey, code: string) => void;
};

const OccupationFilters = ({ options, selections, onSelect }: OccupationFiltersProps) => {
  return (
    <div className="space-y-4">
      {OCCUPATION_FILTERS.map((filter, index) => {
        const parentKey = index === 0 ? null : OCCUPATION_FILTERS[index - 1].key;
        const parentSelected = parentKey ? Boolean(selections[parentKey]) : true;
        const disabled = !parentSelected;

        return (
          <label key={filter.key} className="block space-y-2">
            <span className="text-sm font-medium">{filter.label}</span>
            <select
              value={selections[filter.key]?.occupation_code ?? ""}
              disabled={disabled}
              onChange={(event) => onSelect(filter.key, event.target.value)}
              className="h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{filter.placeholder}</option>
              {options[filter.key].map((occupation) => (
                <option key={occupation.occupation_code} value={occupation.occupation_code}>
                  {occupation.title}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
};

export default OccupationFilters;
