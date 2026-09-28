import { Check, Search } from "lucide-react";
import type { ReferenceOccupation } from "@/types/reference";

type OccupationSearchProps = {
  query: string;
  hasArea: boolean;
  searching: boolean;
  hasSearched: boolean;
  results: ReferenceOccupation[];
  onQueryChange: (value: string) => void;
  onChoose: (occupation: ReferenceOccupation) => void;
  selectedCode: string | null;
};

export default function OccupationSearch({ query, hasArea, searching, hasSearched, results, onQueryChange, onChoose, selectedCode }: OccupationSearchProps) {
  const canSearch = query.trim().length >= 2 || (hasArea && !query.trim());
  return (
    <div className="space-y-3">
      <label htmlFor="job-search" className="block text-sm font-semibold">Job title</label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input id="job-search" type="search" autoComplete="off" value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder="e.g. teacher, sales assistant"
          aria-describedby="job-search-help"
          className="h-12 w-full rounded-xl border border-white/80 bg-white/95 pl-10 pr-4 text-sm outline-none shadow-sm transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
      </div>
      <p id="job-search-help" className="text-xs text-muted-foreground">Type a job title, or choose a type of work to see its jobs.</p>
      <div role="status" className="text-sm text-muted-foreground">
        {canSearch && searching ? "Finding jobs…" : canSearch && hasSearched && !results.length
          ? "No matches yet. Try a different title or choose All types of work."
          : canSearch && hasSearched ? "Choose the closest match." : query.trim().length === 1 ? "Type one more letter to search." : ""}
      </div>
      {canSearch && !searching && results.length > 0 && (
        <ul aria-label="Matching jobs" className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-white/70 p-1">
          {results.map(item => (
            <li key={item.occupation_code}>
              <button type="button" aria-pressed={selectedCode === item.occupation_code}
                onClick={() => onChoose(item)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selectedCode === item.occupation_code ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}>
                <span>{item.title}</span>
                {selectedCode === item.occupation_code && <Check aria-hidden="true" className="size-4 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
