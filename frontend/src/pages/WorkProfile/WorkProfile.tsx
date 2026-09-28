import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccount } from "@/components/account/useAccount";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import OccupationSearch from "./components/OccupationSearch";
import SelectedOccupationSummary from "./components/SelectedOccupationSummary";
import { useOccupationFilters } from "./hooks/useOccupationFilters";
import { beginOccupationChange, clearSelectedOccupation, readTaskWorkspace, hasConfirmedAnalysis } from "@/features/work-profile/userProfile";
import { currentWorkspaceSession, flushWorkspace } from "@/services/accountStorage";
import type { ReferenceOccupation } from "@/types/reference";

// Plain labels for the existing top-level reference groups; codes stay unchanged.
const workAreaLabels: Record<string, string> = {
  "0": "Armed forces", "1": "Management", "2": "Professional roles",
  "3": "Technical and associate professional roles", "4": "Office and clerical support",
  "5": "Sales and service", "6": "Agriculture, forestry and fishing",
  "7": "Skilled trades", "8": "Machine operation and assembly", "9": "General and manual work",
};

export default function WorkProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAccount();
  const hasWorkspace = Boolean(readTaskWorkspace()?.tasksOccupationCode);
  const requestedReturn = location.state?.returnTo;
  const validReturn = typeof requestedReturn === "string" &&
    [ROUTES.task, ROUTES.aiExposure, ROUTES.skills, ROUTES.learningCentre, ROUTES.plan, ROUTES.possibilities]
      .some(path => requestedReturn.split("?")[0] === path);
  const returnTo = validReturn ? requestedReturn : hasConfirmedAnalysis() ? ROUTES.aiExposure : ROUTES.task;
  const occupation = useOccupationFilters();
  const [selected, setSelected] = useState<ReferenceOccupation | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { clearSelectedOccupation(); }, []);

  async function continueToTasks() {
    if (!selected || saving) return;
    const owner = currentWorkspaceSession();
    setSaving(true);
    setSaveError("");
    try {
      const path = await occupation.pathForUnit(selected);
      if (owner !== currentWorkspaceSession()) return;
      beginOccupationChange({ unit: selected, path });
      await flushWorkspace();
      if (owner === currentWorkspaceSession()) navigate(ROUTES.task);
    } catch (error) {
      if (owner === currentWorkspaceSession()) setSaveError(error instanceof Error ? error.message : "Your job could not be saved. Please try again.");
    } finally { if (owner === currentWorkspaceSession()) setSaving(false); }
  }

  return <div className="space-y-5">
    <PageHeader className="flex-col items-start sm:flex-row sm:items-center" title="What is your job?"
      description="Choose the closest match. Next, describe the tasks you actually do."
      actions={user && hasWorkspace ? <Button variant="link" className="min-h-11 shrink-0 px-0" onClick={() => navigate(returnTo)}>
        <ArrowLeft className="size-4" /> Back to my work
      </Button> : undefined} />
    <section className="profile-glass-card p-5 sm:p-6" aria-label="Choose your job">
      <fieldset disabled={saving} className="space-y-5">
        <legend className="sr-only">Find your job</legend>
        <div className="space-y-2">
          <label htmlFor="work-area" className="block text-sm font-semibold">Type of work <span className="font-normal text-muted-foreground">(optional)</span></label>
          <select id="work-area" value={occupation.area} disabled={occupation.loadingAreas}
            onChange={event => { occupation.setArea(event.target.value); setSelected(null); setSaveError(""); }}
            className="min-h-12 w-full min-w-0 rounded-xl border border-white/80 bg-white px-3 py-3 text-sm shadow-sm focus:outline-primary disabled:opacity-60">
            <option value="">{occupation.loadingAreas ? "Loading types of work…" : "All types of work"}</option>
            {occupation.areas.map(area => <option key={area.occupation_code} value={area.occupation_code}>{workAreaLabels[area.occupation_code] ?? area.title}</option>)}
          </select>
          {occupation.areaError && <p role="alert" className="text-sm text-muted-foreground">{occupation.areaError} <button type="button" className="underline" onClick={occupation.retry}>Retry</button></p>}
        </div>
        <OccupationSearch query={occupation.query} hasArea={Boolean(occupation.area)}
          searching={occupation.searching} hasSearched={occupation.hasSearched} results={occupation.results}
          selectedCode={selected?.occupation_code ?? null}
          onQueryChange={value => { occupation.setQuery(value); setSelected(null); setSaveError(""); }}
          onChoose={job => { setSelected(job); setSaveError(""); }} />
        {occupation.searchError && <p role="alert" className="text-sm text-destructive">{occupation.searchError} <button type="button" className="underline" onClick={occupation.retry}>Retry</button></p>}
      </fieldset>
      {selected && <div className="mt-5 border-t border-white/70 pt-5" aria-live="polite">
        <SelectedOccupationSummary occupation={selected} />
        {saveError && <p role="alert" className="mt-3 text-sm text-destructive">{saveError}</p>}
        <Button disabled={saving} className="profile-blue-btn mt-4 min-h-11 rounded-full px-5" onClick={() => { void continueToTasks(); }}>
          {saving ? "Saving your job…" : saveError ? "Try again" : "Continue to my tasks"}
        </Button>
      </div>}
    </section>
  </div>;
}
