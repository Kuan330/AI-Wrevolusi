import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import OccupationFilters from "@/pages/WorkProfile/components/OccupationFilters";
import OccupationSearch from "@/pages/WorkProfile/components/OccupationSearch";
import { useOccupationFilters } from "@/pages/WorkProfile/hooks/useOccupationFilters";
import { saveSelectedOccupation } from "@/pages/WorkProfile/occupationSession";
import type { ReferenceOccupation } from "@/types/reference";

const WorkProfile = () => {
  const navigate = useNavigate();
  const occupation = useOccupationFilters();

  const goToTasks = (unit: ReferenceOccupation, path: ReferenceOccupation[]) => {
    saveSelectedOccupation({ unit, path });
    navigate(ROUTES.task);
  };

  const handleContinue = () => {
    if (!occupation.selectedUnit) return;
    goToTasks(occupation.selectedUnit, occupation.selectedPath);
  };

  const handleSearchChoice = async (unit: ReferenceOccupation) => {
    const path = await occupation.pathForUnit(unit);
    goToTasks(unit, path);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find the occupation that matches your work"
        description="Use the filters below, or search for a specific occupation at the bottom."
      />

      {occupation.error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
          {occupation.error}
        </div>
      ) : null}

      <OccupationFilters
        options={occupation.options}
        selections={occupation.selections}
        onSelect={(key, code) => void occupation.selectFilter(key, code)}
      />

      <Button className="h-11 w-full rounded-xl" disabled={!occupation.selectedUnit} onClick={handleContinue}>
        Continue to your tasks
      </Button>

      <OccupationSearch
        query={occupation.query}
        searching={occupation.searching}
        hasSearched={occupation.hasSearched}
        results={occupation.searchResults}
        onQueryChange={occupation.setQuery}
        onSearch={() => void occupation.searchUnits()}
        onChoose={(unit) => void handleSearchChoice(unit)}
      />
    </div>
  );
};

export default WorkProfile;
