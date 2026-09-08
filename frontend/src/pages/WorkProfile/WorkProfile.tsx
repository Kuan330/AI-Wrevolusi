import { ArrowLeft } from "lucide-react";
import { useAccount } from "@/components/account/useAccount";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { GradientPill } from "@/components/ui/gradient-pill";
import { ROUTES } from "@/constants/routes";
import OccupationFilters from "@/pages/WorkProfile/components/OccupationFilters";
import OccupationSearch from "@/pages/WorkProfile/components/OccupationSearch";
import SelectedOccupationSummary from "@/pages/WorkProfile/components/SelectedOccupationSummary";
import {
  useOccupationFilters,
  type OccupationSearchResult,
} from "@/pages/WorkProfile/hooks/useOccupationFilters";
import {
  clearSelectedOccupation,
  readTaskWorkspace,
  hasConfirmedAnalysis,
  saveSelectedOccupation,
} from "@/pages/WorkProfile/userProfile";
import type { ReferenceOccupation } from "@/types/reference";

type WorkProfileMode = "search" | "filters";

const WorkProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAccount();
  const hasWorkspace = Boolean(readTaskWorkspace()?.tasksOccupationCode);
  const requestedReturn = location.state?.returnTo;
  const validReturn = typeof requestedReturn === "string" &&
    [ROUTES.task, ROUTES.aiExposure, ROUTES.skills, ROUTES.learningCentre, ROUTES.plan, ROUTES.possibilities].some(path => requestedReturn.split("?")[0] === path);
  const returnTo = validReturn ? requestedReturn : hasConfirmedAnalysis() ? ROUTES.aiExposure : ROUTES.task;

  const occupation = useOccupationFilters();
  const [mode, setModeState] = useState<WorkProfileMode>("filters");
  const [selectedFromSearch, setSelectedFromSearch] = useState<OccupationSearchResult | null>(null);

  useEffect(() => {
    // Occupations are selected for the current flow only. The task workspace
    // remains available separately so returning to the task list is possible
    // without persisting the full occupation hierarchy in user data.
    clearSelectedOccupation();
  }, []);

  const persistOccupation = (unit: ReferenceOccupation, path: ReferenceOccupation[]) => {
    saveSelectedOccupation({ unit, path });
  };

  const goToTasks = (unit: ReferenceOccupation, path: ReferenceOccupation[]) => {
    persistOccupation(unit, path);
    navigate(ROUTES.task);
  };

  const activeUnit = mode === "search" ? selectedFromSearch?.unit ?? null : occupation.selectedUnit;
  const activePath = mode === "search" ? selectedFromSearch?.path ?? [] : occupation.selectedPath;
  const confirmedUnit = activeUnit;
  const confirmedPath = activePath;


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
        description="Search by job title, or browse by field of work."
        actions={user && hasWorkspace ? (
          <Button variant="outline" className="shrink-0 rounded-full" onClick={() => {
            clearSelectedOccupation();
            navigate(returnTo);
          }}><ArrowLeft className="size-4"/> Back to previous page</Button>
        ) : undefined}
      />

      {occupation.error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          {occupation.error}
          <button type="button" className="ml-3 underline" onClick={() => window.location.reload()}>
            Retry
          </button>
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
              <GradientPill asChild className="shrink-0 transition">
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
              <GradientPill asChild className="shrink-0 transition">
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
              selectedCode={selectedFromSearch?.unit.occupation_code ?? null}
              onQueryChange={handleQueryChange}
              onChoose={handleSearchChoice}
            />
          </>
        )}

        <div className="mt-4 border-t border-white/70 pt-4">
          <SelectedOccupationSummary occupation={confirmedUnit} />
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
