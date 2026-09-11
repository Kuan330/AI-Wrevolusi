import type { ComponentProps } from "react";
import FilterableSelect from "@/components/ui/filterable-select";
import {
  OCCUPATION_FILTERS,
  type OccupationFilterKey,
} from "@/pages/WorkProfile/occupationFilters";
import type { ReferenceOccupation } from "@/types/reference";

type OccupationFiltersProps = {
  options: Record<OccupationFilterKey, ReferenceOccupation[]>;
  selections: Record<OccupationFilterKey, ReferenceOccupation | null>;
  onSelect: (key: OccupationFilterKey, code: string) => void;
};

const OccupationFilters = (props: OccupationFiltersProps) => {
  const { options, selections, onSelect } = props;
  return (
    <form className="space-y-4">
      {OCCUPATION_FILTERS.map((filter, index) => {
        const parentKey =
          index === 0 ? null : OCCUPATION_FILTERS[index - 1].key;
        const parentSelected = parentKey
          ? Boolean(selections[parentKey])
          : true;
        const disabled = !parentSelected;
        const selected = selections[filter.key];
        const parentLabel = parentKey
          ? (OCCUPATION_FILTERS.find((item) => item.key === parentKey)?.label ??
            "the previous field")
          : null;

        const filterableSelectProps1 = {
          value: selected?.occupation_code ?? "",
          disabled: disabled,
          showSearchIcon: false,
          placeholder: filter.placeholder,
          options: options[filter.key].map((occupation) => ({
            value: occupation.occupation_code,
            label: occupation.title,
          })),
          emptyMessage: "No occupations match your input.",
          onValueChange: (code) => {
            onSelect(filter.key, code);
          },
        } satisfies Partial<ComponentProps<typeof FilterableSelect>>;
        return (
          <div key={filter.key} className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              {filter.label}
            </label>
            <FilterableSelect {...filterableSelectProps1} />
            {disabled ? (
              <p className="text-xs text-muted-foreground">{`Select ${parentLabel} first.`}</p>
            ) : null}
          </div>
        );
      })}
    </form>
  );
};

export default OccupationFilters;
