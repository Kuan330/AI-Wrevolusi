import { useNavigate } from "react-router-dom";
import { useState } from "react";

import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import OccupationFilters from "@/pages/WorkProfile/components/OccupationFilters";
import OccupationSearch from "@/pages/WorkProfile/components/OccupationSearch";
import {
  useOccupationFilters,
  type OccupationSearchResult,
} from "@/pages/WorkProfile/hooks/useOccupationFilters";
import { saveSelectedOccupation } from "@/pages/WorkProfile/occupationSession";
import type { ReferenceOccupation } from "@/types/reference";

type WorkProfileMode = "search" | "filters";

const modeSwitchClassName =
  "inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold text-[#3d5f7a] shadow-sm transition hover:brightness-[0.97]";

const modeSwitchStyle = {
  background: "linear-gradient(90deg, #eaf3fb 0%, #f5f3f8 48%, #f8ecef 100%)",
} as const;

const WorkProfile = () => {
  const navigate = useNavigate();
  const occupation = useOccupationFilters();
  const [mode, setModeState] = useState<WorkProfileMode>("filters");
  const [selectedFromSearch, setSelectedFromSearch] = useState<OccupationSearchResult | null>(null);

  const goToTasks = (unit: ReferenceOccupation, path: ReferenceOccupation[]) => {
    saveSelectedOccupation({ unit, path });
    navigate(ROUTES.task);
  };

  const activeUnit = mode === "search" ? selectedFromSearch?.unit ?? null : occupation.selectedUnit;
  const activePath = mode === "search" ? selectedFromSearch?.path ?? [] : occupation.selectedPath;

  const setMode = (nextMode: WorkProfileMode) => {
    if (nextMode === mode) return;

    if (nextMode === "filters") {
      occupation.resetSearch();
      setSelectedFromSearch(null);
    } else {
      occupation.resetFilters();
    }

    setModeState(nextMode);
  };

  const handleContinue = () => {
    if (!activeUnit) return;
    goToTasks(activeUnit, activePath);
  };

  const handleSearchChoice = (result: OccupationSearchResult) => {
    setSelectedFromSearch(result);
    occupation.setQuery(result.unit.title);
  };

  const handleQueryChange = (value: string) => {
    occupation.setQuery(value);
    if (selectedFromSearch && value.trim() !== selectedFromSearch.unit.title) {
      setSelectedFromSearch(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Find the occupation that matches your work"
        description="Choose your field first, then narrow down to the occupation that matches your work."
      />

      {occupation.error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          {occupation.error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/75 bg-white/70 p-5 shadow-[0_10px_28px_rgba(61,43,54,0.08)] backdrop-blur-xl">
        {mode === "filters" ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Filter by category</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose from the form fields to narrow down your exact occupation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode("search")}
                className={modeSwitchClassName}
                style={modeSwitchStyle}
              >
                Search by job title instead
              </button>
            </div>
            <OccupationFilters
              options={occupation.options}
              selections={occupation.selections}
              onSelect={(key, code) => {
                void occupation.selectFilter(key, code);
              }}
            />
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Search by job title</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Type and see matching occupations instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode("filters")}
                className={modeSwitchClassName}
                style={modeSwitchStyle}
              >
                Back to category filters
              </button>
            </div>
            <OccupationSearch
              query={occupation.query}
              searching={occupation.searching}
              hasSearched={occupation.hasSearched}
              results={occupation.searchResults}
              selectedCode={selectedFromSearch?.unit.occupation_code ?? null}
              onQueryChange={handleQueryChange}
              onChoose={handleSearchChoice}
            />
          </>
        )}

        <div className="mt-4 border-t border-white/70 pt-4">
          <p className="text-sm text-muted-foreground">
            {activeUnit ? `Selected: ${activeUnit.title}` : "No occupation selected yet."}
          </p>
          <Button
            className="mt-3 h-11 w-full rounded-xl bg-[#c99589] text-white shadow-[0_8px_18px_rgba(201,149,137,0.34)] hover:bg-[#b98579]"
            disabled={!activeUnit}
            onClick={handleContinue}
          >
            Confirm and continue
          </Button>
        </div>
      </section>
    </div>
  );
};

export default WorkProfile;
