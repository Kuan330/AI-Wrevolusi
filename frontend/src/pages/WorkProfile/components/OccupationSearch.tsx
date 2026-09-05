import { Search } from "lucide-react";

import { useState } from "react";

import type { OccupationSearchResult } from "@/pages/WorkProfile/hooks/useOccupationFilters";

type OccupationSearchProps = {
  query: string;
  searching: boolean;
  hasSearched: boolean;
  results: OccupationSearchResult[];
  onQueryChange: (value: string) => void;
  onChoose: (occupation: OccupationSearchResult) => void;
  selectedCode: string | null;
};

const OccupationSearch = ({
  query,
  searching,
  hasSearched,
  results,
  onQueryChange,
  onChoose,
  selectedCode,
}: OccupationSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const canSearch = query.trim().length >= 2;
  const showDropdown = isOpen && canSearch;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 120);
            }}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setIsOpen(true);
            }}
            aria-label="Search occupations by job title or code"
            placeholder="Search by job title or occupation code"
            className="h-12 w-full rounded-xl border border-white/80 bg-white/95 pl-10 pr-4 text-sm outline-none shadow-sm transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
        {showDropdown ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-y-auto rounded-xl border border-white/85 bg-white p-2 shadow-lg">
            {searching ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Searching occupations...</p>
            ) : null}
            {!searching && hasSearched && results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No matching occupations found. Try another title or browse by category.
              </p>
            ) : null}
            {!searching && results.length > 0 ? (
              <div className="space-y-1">
                {results.map((item) => (
                  <button
                    key={item.unit.occupation_code}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChoose(item);
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                      selectedCode === item.unit.occupation_code
                        ? "bg-primary/10 ring-1 ring-primary/35"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{item.unit.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.pathLabel
                        ? `${item.unit.title} - ${item.pathLabel}`
                        : item.unit.title}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {!canSearch ? (
        <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
      ) : null}
      {selectedCode ? (
        <p className="text-xs text-primary">Occupation selected. You can continue now.</p>
      ) : null}
    </div>
  );
};

export default OccupationSearch;
