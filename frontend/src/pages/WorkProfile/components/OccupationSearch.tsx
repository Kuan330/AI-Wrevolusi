import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReferenceOccupation } from "@/types/reference";

type OccupationSearchProps = {
  query: string;
  searching: boolean;
  hasSearched: boolean;
  results: ReferenceOccupation[];
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onChoose: (occupation: ReferenceOccupation) => void;
};

const OccupationSearch = ({
  query,
  searching,
  hasSearched,
  results,
  onQueryChange,
  onSearch,
  onChoose,
}: OccupationSearchProps) => {
  return (
    <div className="space-y-3 border-t pt-6">
      <div>
        <p className="text-sm font-medium">Or search for a specific occupation</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Search only returns specific occupations, not broader groups.
        </p>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder="Search by job title"
            className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <Button className="h-11 rounded-xl px-5" disabled={searching} onClick={onSearch}>
          Search
        </Button>
      </div>
      {hasSearched && results.length === 0 && !searching ? (
        <p className="text-sm text-muted-foreground">No specific occupations match that title.</p>
      ) : null}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((occupation) => (
            <button
              key={occupation.occupation_code}
              type="button"
              onClick={() => onChoose(occupation)}
              className="w-full rounded-xl border bg-card p-4 text-left transition hover:border-primary/35"
            >
              <p className="font-medium">{occupation.title}</p>
              {occupation.description ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {occupation.description}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default OccupationSearch;
