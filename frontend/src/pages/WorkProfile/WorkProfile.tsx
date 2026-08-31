import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { GradientPill } from "@/components/ui/gradient-pill";
import { ROUTES } from "@/constants/routes";
import OccupationFilters from "@/pages/WorkProfile/components/OccupationFilters";
import OccupationSearch from "@/pages/WorkProfile/components/OccupationSearch";
import {
  useOccupationFilters,
  type OccupationSearchResult,
} from "@/pages/WorkProfile/hooks/useOccupationFilters";
import {
  readSelectedOccupation,
  resetTaskSessionForOccupation,
  saveSelectedOccupation,
} from "@/pages/WorkProfile/occupationSession";
import type { ReferenceOccupation } from "@/types/reference";

type WorkProfileMode = "search" | "filters";

const WorkProfile = () => {
  const navigate = useNavigate();
  const occupation = useOccupationFilters();
  const [mode, setModeState] = useState<WorkProfileMode>("filters");
  const [selectedFromSearch, setSelectedFromSearch] = useState<OccupationSearchResult | null>(null);
  const [savedOccupation, setSavedOccupation] = useState(() => readSelectedOccupation());
  const [hydrated, setHydrated] = useState(false);

  const persistOccupation = (unit: ReferenceOccupation, path: ReferenceOccupation[]) => {
    const next = { unit, path };
    saveSelectedOccupation(next);
    setSavedOccupation(next);
  };

  useEffect(() => {
    if (hydrated || occupation.loading || occupation.options.major.length === 0) return;
    const saved = readSelectedOccupation();
    if (!saved?.path.length) {
      setHydrated(true);
      return;
    }
    void occupation.hydrateFromPath(saved.path).finally(() => setHydrated(true));
    // Restore saved occupation once majors are ready (Change occupation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, occupation.loading, occupation.options.major.length]);

  const goToTasks = (unit: ReferenceOccupation, path: ReferenceOccupation[]) => {
    resetTaskSessionForOccupation({ unit, path });
    setSavedOccupation({ unit, path });
    navigate(ROUTES.task, { state: { taskEntry: "occupation" } });
  };

  const activeUnit = mode === "search" ? selectedFromSearch?.unit ?? null : occupation.selectedUnit;
  const activePath = mode === "search" ? selectedFromSearch?.path ?? [] : occupation.selectedPath;
  const confirmedUnit = activeUnit ?? savedOccupation?.unit ?? null;
  const confirmedPath = activeUnit ? activePath : savedOccupation?.path ?? [];

  useEffect(() => {
    if (!activeUnit) return;
    persistOccupation(activeUnit, activePath);
    // Persist when the chosen occupation code changes, not on every path array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUnit?.occupation_code]);

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
    if (!confirmedUnit) return;
    goToTasks(confirmedUnit, confirmedPath);
  };

  const handleSearchChoice = (result: OccupationSearchResult) => {
    setSelectedFromSearch(result);
    occupation.setQuery(result.unit.title);
    persistOccupation(result.unit, result.path);
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

      <section className="profile-glass-card p-5">
        {mode === "filters" ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Filter by category</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose from the form fields to narrow down your exact occupation.
                </p>
              </div>
              <GradientPill asChild className="shrink-0 transition hover:brightness-[0.97]">
                <button type="button" onClick={() => setMode("search")}>
                  Search by job title instead
                </button>
              </GradientPill>
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
              <GradientPill asChild className="shrink-0 transition hover:brightness-[0.97]">
                <button type="button" onClick={() => setMode("filters")}>
                  Back to category filters
                </button>
              </GradientPill>
            </div>
            <OccupationSearch
              query={occupation.query}
              searching={occupation.searching}
              hasSearched={occupation.hasSearched}
              results={occupation.searchResults}
              selectedCode={selectedFromSearch?.unit.occupation_code ?? savedOccupation?.unit.occupation_code ?? null}
              onQueryChange={handleQueryChange}
              onChoose={handleSearchChoice}
            />
          </>
        )}

        <div className="mt-4 border-t border-white/70 pt-4">
          <p className="text-sm text-muted-foreground">
            {confirmedUnit ? `Selected: ${confirmedUnit.title}` : "No occupation selected yet."}
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              className="profile-blue-btn h-10 whitespace-nowrap rounded-full px-5"
              disabled={!confirmedUnit}
              onClick={handleContinue}
            >
              Confirm and continue
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WorkProfile;
